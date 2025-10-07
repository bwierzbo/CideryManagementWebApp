export { default } from "next-auth/middleware";

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
  ],
};