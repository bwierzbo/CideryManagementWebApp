import 'dotenv/config'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from 'db'
import { users } from 'db/src/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        console.log('🔍 Auth attempt for:', credentials.email)
        console.log('🔗 DATABASE_URL available:', !!process.env.DATABASE_URL)

        try {
          const user = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email))
            .limit(1)

          if (!user[0] || !user[0].isActive) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user[0].passwordHash
          )

          if (!isPasswordValid) {
            return null
          }

          // Update last login timestamp
          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user[0].id))

          return {
            id: user[0].id,
            email: user[0].email,
            name: user[0].name,
            role: user[0].role,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub
        session.user.role = token.role as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST, authOptions }