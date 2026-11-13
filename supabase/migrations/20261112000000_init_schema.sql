-- =============================================================================
-- MIGRATION: 20261112000000_init_schema.sql
-- Mô tả: Khởi tạo toàn bộ bảng, chỉ mục, trigger, RPC và Row Level Security (RLS)
-- cho ứng dụng web ôn tập từ vựng tiếng Trung HSK (Next.js + Supabase)
-- =============================================================================

-- Bật extension tạo UUID
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. BẢNG PROFILES (Hồ sơ người dùng & phân quyền)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);

-- Hàm kiểm tra người dùng hiện tại có phải là Admin hợp lệ (không bị khóa)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_locked = false
  );
$$;

-- Trigger tự động tạo bản ghi trong bảng profiles khi người dùng đăng ký qua Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
begin
  base_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)
  );
  insert into public.profiles (id, username, display_name, avatar_url, role)
  values (
    new.id,
    base_username,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. BẢNG DECKS (Bộ thẻ từ vựng theo chủ đề hoặc cấp độ HSK 1-6)
-- -----------------------------------------------------------------------------
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  hsk_level int not null default 1 check (hsk_level between 1 and 6),
  created_at timestamptz not null default now()
);

create index idx_decks_hsk_level on public.decks(hsk_level);

-- -----------------------------------------------------------------------------
-- 3. BẢNG WORDS (Từ vựng tiếng Trung, Pinyin, Nghĩa, Câu ví dụ)
-- -----------------------------------------------------------------------------
create table public.words (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  hanzi text not null,
  pinyin text not null,
  meaning_vi text not null,
  meaning_en text,
  topic text,
  example_hanzi text,
  example_pinyin text,
  example_meaning text,
  created_at timestamptz not null default now(),
  constraint uq_words_deck_hanzi unique (deck_id, hanzi)
);

create index idx_words_deck_id on public.words(deck_id);
create index idx_words_hanzi on public.words(hanzi);

-- -----------------------------------------------------------------------------
-- 4. BẢNG USER_PROGRESS (Tiến độ ôn tập & Lặp lại ngắt quãng Spaced Repetition)
-- -----------------------------------------------------------------------------
create table public.user_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  correct_count int not null default 0 check (correct_count >= 0),
  wrong_count int not null default 0 check (wrong_count >= 0),
  last_reviewed_at timestamptz not null default now(),
  next_review_at timestamptz not null default now(),
  is_difficult boolean not null default false,
  primary key (user_id, word_id)
);

create index idx_user_progress_user_next_review on public.user_progress(user_id, next_review_at);
create index idx_user_progress_difficult on public.user_progress(user_id, is_difficult) where is_difficult = true;

-- -----------------------------------------------------------------------------
-- 5. BẢNG STUDY_SESSIONS (Lịch sử mỗi lượt học & điểm số)
-- -----------------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  mode text not null check (mode in ('flashcard', 'quiz', 'typing')),
  score int not null default 0 check (score >= 0 and score <= 10000),
  correct int not null default 0 check (correct >= 0),
  total int not null default 0 check (total > 0 and correct <= total),
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index idx_study_sessions_user_created on public.study_sessions(user_id, created_at desc);
create index idx_study_sessions_deck_created on public.study_sessions(deck_id, created_at desc);
create index idx_study_sessions_created on public.study_sessions(created_at desc);

-- -----------------------------------------------------------------------------
-- 6. BẢNG IMPORT_LOGS (Lịch sử import dữ liệu của Admin)
-- -----------------------------------------------------------------------------
create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  total_rows int not null default 0,
  success_rows int not null default 0,
  error_rows int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_import_logs_created on public.import_logs(created_at desc);

-- -----------------------------------------------------------------------------
-- 7. VIEW & FUNCTION BẢNG XẾP HẠNG (LEADERBOARD)
-- -----------------------------------------------------------------------------
-- View tổng hợp toàn thời gian (All-time Leaderboard View)
create or replace view public.leaderboard_all_time as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  coalesce(sum(s.score), 0)::bigint as total_score,
  count(s.id)::bigint as sessions_count,
  coalesce(sum(s.correct), 0)::bigint as total_correct,
  rank() over (order by coalesce(sum(s.score), 0) desc, count(s.id) asc) as rank_position
from public.profiles p
left join public.study_sessions s on s.user_id = p.id
where p.is_locked = false
group by p.id, p.username, p.display_name, p.avatar_url;

-- Hàm RPC linh hoạt lấy bảng xếp hạng theo khoảng thời gian ('all', 'week', 'month') và theo bộ từ (p_deck_id)
create or replace function public.get_leaderboard(
  p_period text default 'all',
  p_deck_id uuid default null,
  p_limit int default 100
)
returns table (
  rank_position bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  total_score bigint,
  sessions_count bigint,
  accuracy numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with filtered_sessions as (
    select
      s.user_id,
      s.score,
      s.correct,
      s.total
    from public.study_sessions s
    where (p_deck_id is null or s.deck_id = p_deck_id)
      and (
        p_period = 'all'
        or (p_period = 'week' and s.created_at >= date_trunc('week', now()))
        or (p_period = 'month' and s.created_at >= date_trunc('month', now()))
      )
  ),
  aggregated as (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      coalesce(sum(fs.score), 0)::bigint as total_score,
      count(fs.user_id)::bigint as sessions_count,
      case
        when coalesce(sum(fs.total), 0) > 0
          then round((sum(fs.correct)::numeric / sum(fs.total)::numeric) * 100, 1)
        else 0
      end as accuracy
    from public.profiles p
    inner join filtered_sessions fs on fs.user_id = p.id
    where p.is_locked = false
    group by p.id, p.username, p.display_name, p.avatar_url
  )
  select
    rank() over (order by a.total_score desc, a.accuracy desc, a.sessions_count asc) as rank_position,
    a.user_id,
    a.username,
    a.display_name,
    a.avatar_url,
    a.total_score,
    a.sessions_count,
    a.accuracy
  from aggregated a
  order by rank_position asc
  limit p_limit;
$$;

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES CHO TẤT CẢ CÁC BẢNG
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.decks enable row level security;
alter table public.words enable row level security;
alter table public.user_progress enable row level security;
alter table public.study_sessions enable row level security;
alter table public.import_logs enable row level security;

-- 8.1 Policies cho bảng PROFILES
-- Người dùng đọc được profile của chính mình; Admin đọc được toàn bộ profiles
create policy "Users can view own profile or Admin can view all"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

-- Người dùng chỉ được cập nhật tên hiển thị / avatar của chính mình (không được tự nâng quyền role hoặc mở khóa)
create policy "Users can update own basic profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and is_locked = (select is_locked from public.profiles where id = auth.uid())
  );

-- Admin có toàn quyền cập nhật profiles (đổi role, khóa tài khoản)
create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 8.2 Policies cho bảng DECKS
-- Mọi người đã đăng nhập đều đọc được decks
create policy "Authenticated users can read decks"
  on public.decks for select
  to authenticated
  using (true);

-- Chỉ Admin mới được thêm, sửa, xóa decks
create policy "Only admins can insert decks"
  on public.decks for insert
  to authenticated
  with check (public.is_admin());

create policy "Only admins can update decks"
  on public.decks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Only admins can delete decks"
  on public.decks for delete
  to authenticated
  using (public.is_admin());

-- 8.3 Policies cho bảng WORDS
-- Mọi người đã đăng nhập đều đọc được words
create policy "Authenticated users can read words"
  on public.words for select
  to authenticated
  using (true);

-- Chỉ Admin mới được thêm, sửa, xóa words
create policy "Only admins can insert words"
  on public.words for insert
  to authenticated
  with check (public.is_admin());

create policy "Only admins can update words"
  on public.words for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Only admins can delete words"
  on public.words for delete
  to authenticated
  using (public.is_admin());

-- 8.4 Policies cho bảng USER_PROGRESS
-- Người dùng chỉ đọc/ghi dữ liệu tiến độ của chính họ
create policy "Users manage own progress select"
  on public.user_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users manage own progress insert"
  on public.user_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users manage own progress update"
  on public.user_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own progress delete"
  on public.user_progress for delete
  to authenticated
  using (auth.uid() = user_id);

-- 8.5 Policies cho bảng STUDY_SESSIONS
-- Người dùng chỉ đọc/ghi phiên học của chính họ (Admin có thể xem thống kê)
create policy "Users can view own study sessions"
  on public.study_sessions for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Users can insert own study sessions"
  on public.study_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 8.6 Policies cho bảng IMPORT_LOGS
-- Chỉ Admin mới được đọc và ghi import_logs
create policy "Only admins can view import logs"
  on public.import_logs for select
  to authenticated
  using (public.is_admin());

create policy "Only admins can insert import logs"
  on public.import_logs for insert
  to authenticated
  with check (public.is_admin() and auth.uid() = admin_id);

-- -----------------------------------------------------------------------------
-- 9. DỮ LIỆU KHỞI TẠO MẶC ĐỊNH (SEED DECKS)
-- -----------------------------------------------------------------------------
insert into public.decks (name, description, hsk_level)
values
  ('HSK 1 - Giao tiếp Cơ bản', 'Chào hỏi, đại từ, số đếm và giao tiếp hàng ngày cơ bản trong HSK 1', 1),
  ('HSK 1 - Gia đình & Đời sống', 'Từ vựng về gia đình, ẩm thực, thời gian và hoạt động thường nhật HSK 1', 1),
  ('HSK 2 - Sinh hoạt & Công việc', 'Từ vựng mở rộng về mua sắm, di chuyển, cảm xúc và công việc HSK 2', 2)
on conflict (name) do nothing;
