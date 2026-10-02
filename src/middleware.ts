import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/session") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Invitation preview remains public; confirmation enforces auth in-page.
  if (pathname.startsWith("/join/")) {
    return NextResponse.next();
  }

  const protectedPath =
    pathname === "/communities" ||
    pathname.startsWith("/communities/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/");

  if (!protectedPath) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
