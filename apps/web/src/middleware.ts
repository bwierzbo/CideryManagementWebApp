import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Define role-based access rules
    const adminOnlyPaths = [
      "/admin",
      "/settings/users",
      "/reports/financial",
    ];

    const operatorPaths = [
      "/pressing",
      "/cellar",
      "/packaging",
      "/inventory",
      "/vendors",
      "/purchase",
    ];

    const viewerRestrictedPaths = [
      ...adminOnlyPaths,
      "/settings",
    ];

    // Check admin-only paths
    if (adminOnlyPaths.some(p => path.startsWith(p))) {
      if (token?.role !== "admin") {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }
    }

    // Check viewer restrictions
    if (token?.role === "viewer") {
      // Viewers can't access certain paths
      if (viewerRestrictedPaths.some(p => path.startsWith(p))) {
        return NextResponse.redirect(new URL("/unauthorized", req.url));
      }

      // Viewers can't access any POST/PUT/DELETE operations
      if (req.method !== "GET" && path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Viewers cannot modify data" },
          { status: 403 }
        );
      }
    }

    // All authenticated users can proceed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

// Specify which routes require authentication
export const config = {
  matcher: [
    // Protected routes
    "/dashboard/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/pressing/:path*",
    "/cellar/:path*",
    "/packaging/:path*",
    "/inventory/:path*",
    "/vendors/:path*",
    "/purchase/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/batch/:path*",
    "/api/trpc/:path*",
    // Exclude public routes
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};