import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths requiring protection
  const isAdminPath = pathname.startsWith("/admin");
  const isRefereePath = pathname.startsWith("/referee");
  const isLoginPath = pathname.startsWith("/login");

  if (!isAdminPath && !isRefereePath && !isLoginPath) {
    return NextResponse.next();
  }

  // Get token cookie
  const token = request.cookies.get("token")?.value;
  const session = token ? await verifyJWT(token) : null;

  if (isLoginPath) {
    if (session) {
      // Already logged in, redirect to respective dashboard
      const dashboard = session.role === "ADMIN" ? "/admin" : "/referee";
      return NextResponse.redirect(new URL(dashboard, request.url));
    }
    return NextResponse.next();
  }

  // If trying to access protected page without session, redirect to login
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    // Keep track of original destination
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role checks
  if (isAdminPath && session.role !== "ADMIN") {
    // Non-admin trying to access admin page
    return NextResponse.redirect(new URL("/referee", request.url));
  }

  return NextResponse.next();
}

// Config to specify matching paths
export const config = {
  matcher: ["/admin/:path*", "/referee/:path*", "/login"],
};
