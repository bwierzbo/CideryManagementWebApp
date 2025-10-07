import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Temporarily disabled middleware for debugging
// TODO: Re-enable auth middleware once Edge Runtime issue is resolved
export async function middleware(req: NextRequest) {
  // Pass through all requests for now
  return NextResponse.next();
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