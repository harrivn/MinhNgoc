# HSK Master — Ứng dụng Web Ôn Tập Từ Vựng Tiếng Trung (Next.js + Supabase + Vercel)

Dự án hoàn chỉnh sử dụng **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, RLS)**, hỗ trợ đầy đủ:
- Học từ vựng theo bộ thẻ & cấp độ HSK 1–6: **Flashcard**, **Trắc nghiệm 4 đáp án**, **Điền từ (Chữ Hán / Pinyin)**, **Phát âm chuẩn `zh-CN` (Web Speech API)**, **Đánh dấu từ khó**, và **Lặp lại ngắt quãng (Spaced Repetition)**.
- **Tính điểm trên Server** chống gian lận kèm thưởng chuỗi đúng liên tiếp (**Streak**) và **Bảng xếp hạng** (Toàn thời gian, Tuần này, Tháng này, Theo bộ từ).
- **Quản trị viên (`/admin/*`)**: Bảo vệ đa tầng (Middleware + Server Layout + Server Actions + RLS), hỗ trợ **Import CSV / Excel (.xlsx) / JSON** với kiểm tra **Zod** từng dòng, xem trước 20 dòng đầu, thanh tiến độ Batch Import, quản lý từ vựng (`/admin/words`) và quản lý người dùng (`/admin/users`).

---

## 1. Cấu trúc thư mục

```text
hsk-vocab-nextjs/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx
│   │   ├── decks/
│   │   │   ├── page.tsx
│   │   │   └── [id]/study/page.tsx
│   │   ├── leaderboard/page.tsx
│   │   └── profile/page.tsx
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── import/page.tsx
│   │   ├── words/page.tsx
│   │   └── users/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AdminImportClient.tsx
│   ├── AdminUsersClient.tsx
│   ├── AdminWordsClient.tsx
│   ├── Navbar.tsx
│   ├── ProfileForm.tsx
│   ├── SpeakButton.tsx
│   ├── StudyWorkspace.tsx
│   └── ThemeToggle.tsx
├── lib/
│   ├── actions/
│   │   ├── admin-actions.ts
│   │   └── study-actions.ts
│   ├── import/
│   │   ├── batch-importer.ts
│   │   ├── parser.ts
│   │   └── validator.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── middleware.ts
│   │   └── server.ts
│   └── speech.ts
├── public/
│   └── vocab-sample.csv
├── sample-data/
│   └── vocab-sample.csv
├── supabase/
│   └── migrations/
│       └── 20261112000000_init_schema.sql
├── types/
│   └── database.ts
├── .env.example
├── middleware.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 2. Hướng dẫn Cài đặt & Triển khai từng bước

### Bước 1: Tạo Project Supabase và chạy SQL Migration
1. Truy cập [https://supabase.com/dashboard](https://supabase.com/dashboard) và nhấn **New Project**.
2. Sau khi project khởi tạo xong, mở mục **SQL Editor** ở thanh bên trái -> nhấn **New Query**.
3. Copy toàn bộ nội dung file `supabase/migrations/20261112000000_init_schema.sql`, dán vào trình soạn thảo và nhấn **Run**.
4. Vào mục **Project Settings -> API** để lấy:
   - `Project URL` -> gán vào `NEXT_PUBLIC_SUPABASE_URL`
   - `Project API keys -> anon public` -> gán vào `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Bước 2: Tạo tài khoản Admin đầu tiên
1. Chạy ứng dụng và đăng ký tài khoản đầu tiên tại trang `/register` (ví dụ với email `admin@yourdomain.com`).
2. Mở **Supabase Dashboard -> SQL Editor** và chạy câu lệnh SQL sau để nâng quyền tài khoản đó lên `admin`:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@yourdomain.com'
);
```

### Bước 3: Chạy trên máy Local
```bash
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY vào .env.local
npm install
npm run dev
```
Mở trình duyệt tại `http://localhost:3000`.

### Bước 4: Deploy lên Vercel
1. Đẩy toàn bộ mã nguồn lên kho lưu trữ **GitHub**.
2. Đăng nhập [https://vercel.com](https://vercel.com) -> nhấn **Add New... -> Project** -> chọn repository GitHub vừa tạo.
3. Trong mục **Environment Variables**, thêm 3 biến:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (điền domain Vercel của bạn, ví dụ `https://hsk-vocab-master.vercel.app`)
4. Nhấn **Deploy**. Sau khi có domain Vercel, vào **Supabase Dashboard -> Authentication -> URL Configuration** và thêm domain Vercel vào **Site URL** cũng như **Redirect URLs**.
