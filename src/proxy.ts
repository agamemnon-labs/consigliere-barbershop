import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic gate for staff areas: no session cookie, no entry. The real check
 * (valid session, right role) happens on the server in `requireStaff`.
 */
export function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request, { cookiePrefix: "consigliere" });
  if (!cookie) {
    const login = new URL("/staf/masuk", request.url);
    login.searchParams.set("lanjut", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/kasir/:path*", "/admin/:path*"],
};
