import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // This function runs for protected routes
    // Additional middleware logic can go here
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Allow access if user has a valid token
        return !!token;
      },
    },
  },
);

export const config = {
  // Protect all routes except homepage and auth routes
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - / (homepage)
     * - /auth (authentication pages)
     * - /api/auth (NextAuth API routes)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     */
    "/((?!^/$|auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
