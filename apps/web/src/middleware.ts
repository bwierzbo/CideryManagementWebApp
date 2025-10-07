import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname;

    // Get the token from the JWT
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET
    });

    // Define protected paths
    const protectedPaths = [
      "/dashboard",
      "/profile",
      "/admin",
      "/pressing",
      "/cellar",
      "/packaging",
      "/inventory",
      "/vendors",
      "/purchase",
      "/reports",
      "/settings",
      "/batch",
      "/api/trpc",
    ];

    // Check if path requires authentication
    const isProtectedPath = protectedPaths.some(p => path.startsWith(p));

    // If protected path and no token, redirect to signin
    if (isProtectedPath && !token) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(signInUrl);
    }

    // If token exists, check role-based access
    if (token) {
      const adminOnlyPaths = [
        "/admin",
        "/settings/users",
        "/reports/financial",
      ];

      const viewerRestrictedPaths = [
        ...adminOnlyPaths,
        "/settings",
      ];

      // Check admin-only paths
      if (adminOnlyPaths.some(p => path.startsWith(p))) {
        if (token.role !== "admin") {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
      }

      // Check viewer restrictions
      if (token.role === "viewer") {
        if (viewerRestrictedPaths.some(p => path.startsWith(p))) {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }

        // Viewers can't access POST/PUT/DELETE operations
        if (req.method !== "GET" && path.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Viewers cannot modify data" },
            { status: 403 }
          );
        }
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
}

// Specify which routes require authentication
export const config = {
  matcher: [
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
  ],
};