import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedPath =
    pathname.startsWith("/decks") ||
    pathname.startsWith("/leaderboard") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  // Chưa đăng nhập mà vào route bảo vệ -> chuyển hướng về /login
  if (!user && isProtectedPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Nếu đã đăng nhập, kiểm tra trạng thái khóa tài khoản và quyền Admin
  if (user && (isProtectedPath || pathname === "/login" || pathname === "/register")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_locked")
      .eq("id", user.id)
      .single();

    if (profile?.is_locked) {
      await supabase.auth.signOut();
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "account_locked");
      return NextResponse.redirect(loginUrl);
    }

    // Bảo vệ nghiêm ngặt mọi route /admin/* ở tầng Middleware
    if (pathname.startsWith("/admin") && profile?.role !== "admin") {
      const decksUrl = request.nextUrl.clone();
      decksUrl.pathname = "/decks";
      decksUrl.searchParams.set("error", "forbidden_admin");
      return NextResponse.redirect(decksUrl);
    }

    // Đã đăng nhập mà vào /login hoặc /register -> chuyển về /decks
    if (pathname === "/login" || pathname === "/register") {
      const decksUrl = request.nextUrl.clone();
      decksUrl.pathname = "/decks";
      return NextResponse.redirect(decksUrl);
    }
  }

  return response;
}
