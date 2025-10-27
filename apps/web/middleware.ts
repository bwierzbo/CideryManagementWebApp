import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/auth/signin',
  '/auth/signup',
  '/api/auth',  // NextAuth API routes
  '/forgot-password',
  '/reset-password',
];

/**
 * Routes that should redirect to dashboard if already authenticated
 */
const AUTH_ROUTES = ['/auth/signin', '/auth/signup'];

/**
 * Default redirect paths
 */
const DEFAULT_SIGNIN_REDIRECT = '/dashboard';
const DEFAULT_SIGNOUT_REDIRECT = '/auth/signin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route =>
    pathname.startsWith(route)
  );

  // Check if route is an auth page (signin/signup)
  const isAuthRoute = AUTH_ROUTES.some(route =>
    pathname.startsWith(route)
  );

  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;

  // If on an auth route and already signed in, redirect to dashboard
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL(DEFAULT_SIGNIN_REDIRECT, request.url));
  }

  // If accessing protected route without auth, redirect to signin
  if (!isPublicRoute && !isAuthenticated) {
    const signinUrl = new URL('/auth/signin', request.url);
    // Save the intended destination
    signinUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Check for inactive users
  if (isAuthenticated && token.isActive === false) {
    // User is deactivated, sign them out
    const signoutUrl = new URL('/api/auth/signout', request.url);
    return NextResponse.redirect(signoutUrl);
  }

  // Allow the request to continue
  return NextResponse.next();
}

/**
 * Configure which routes this middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
