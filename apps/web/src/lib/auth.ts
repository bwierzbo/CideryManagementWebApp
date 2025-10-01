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
        console.log("🔗 DATABASE_URL available:", !!process.env.DATABASE_URL);
        console.log("🔗 DATABASE_URL preview:", process.env.DATABASE_URL?.substring(0, 60) + "...");

        try {
          console.log("📊 Querying database for user...");
          const user = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email))
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
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub;
        session.user.role = token.role as string;
      }
      return session;
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
