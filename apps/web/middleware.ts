import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  guestRegex,
  isDevelopmentEnvironment,
  isLocalHttpEnvironment,
} from "./lib/constants";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/uploadthing") ||
    pathname.startsWith("/api/models")
  ) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment && !isLocalHttpEnvironment,
  });

  // 认证页面：直接放行，不需要检查 token
  const authPages = ["/login", "/register"];
  if (authPages.includes(pathname)) {
    // 如果已登录且不是访客，重定向到首页
    if (token && !guestRegex.test(token?.email ?? "")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 公开路由：首页和预览页允许访客访问
  const publicRoutes = ["/", "/preview"];
  const isPublicRoute =
    pathname === "/" ||
    publicRoutes.some((route) => route !== "/" && pathname.startsWith(route));

  if (!token) {
    // 公开路由：自动创建访客账户
    if (isPublicRoute) {
      const redirectUrl = encodeURIComponent(request.url);
      return NextResponse.redirect(
        new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
      );
    }

    // 其他路由：重定向到登录页
    const callbackUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  // 访客用户访问非公开路由时，重定向到登录页
  if (isGuest && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(request.url);
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
