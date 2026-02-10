import "dotenv/config";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "db";
import { users } from "db/src/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        console.log("🔍 Auth attempt for:", credentials.email);
        const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
        console.log("🔗 Database URL available:", !!dbUrl);
        console.log("🔗 Database host:", dbUrl?.split("@")[1]?.split("/")[0] || "unknown");

        try {
          console.log("📊 Querying database for user...");
          const user = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email.toLowerCase()))
            .limit(1);

          console.log("✅ Query successful, found user:", !!user[0]);

          if (!user[0]) {
            console.log("❌ User not found in database");
            return null;
          }

          if (!user[0].isActive) {
            console.log("❌ User account is not active");
            return null;
          }

          console.log("✅ User found and active:", user[0].email);

          console.log("🔑 Comparing passwords...");
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user[0].passwordHash,
          );
          console.log("🔑 Password valid:", isPasswordValid);

          if (!isPasswordValid) {
            console.log("❌ Password invalid, rejecting login");
            return null;
          }

          // Update last login timestamp
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user[0].id));

          return {
            id: user[0].id,
            email: user[0].email,
            name: user[0].name,
            role: user[0].role,
            isActive: user[0].isActive,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.isActive = user.isActive;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role as string;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
    async redirect({ url, baseUrl }: any) {
      // If url is relative (starts with /), prepend baseUrl
      if (url?.startsWith("/")) {
        // Don't redirect to signin page
        if (url === "/auth/signin") {
          return `${baseUrl}/dashboard`;
        }
        return `${baseUrl}${url}`;
      }
      // If url starts with baseUrl, it's already absolute and on our domain
      if (url?.startsWith(baseUrl)) {
        return url;
      }
      // Default to dashboard for any other case
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt" as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
