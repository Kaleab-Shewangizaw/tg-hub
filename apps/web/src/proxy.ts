import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic check only: bounce visitors without a session cookie away from
 * /app. Real authorization happens next to the data (requireUser).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has('emberly_session')) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app', '/app/:path*'] };
