import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "db";
import { users } from "db/src/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

// Input validation schemas
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// Store password reset tokens in memory (in production, use Redis or database)
const resetTokens = new Map<string, { email: string; expires: Date }>();

export const userRouter = router({
  // Public endpoint for user registration
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ input }) => {
      const { email, password, name } = input;

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create new user with default operator role
      const newUser = await db
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "operator",
          isActive: true,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      return {
        success: true,
        user: newUser[0],
      };
    }),

  // Request password reset
  requestPasswordReset: publicProcedure
    .input(resetPasswordRequestSchema)
    .mutation(async ({ input }) => {
      const { email } = input;

      // Check if user exists
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user.length === 0) {
        // Don't reveal if user exists or not
        return {
          success: true,
          message: "If an account exists, a reset link has been sent",
        };
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 3600000); // 1 hour expiry

      // Store token (in production, store in database)
      resetTokens.set(token, { email, expires });

      // In production, send email with reset link
      // For now, just log the token
      console.log(`Password reset token for ${email}: ${token}`);

      return {
        success: true,
        message: "If an account exists, a reset link has been sent",
        // In development, return the token for testing
        ...(process.env.NODE_ENV === "development" && { token }),
      };
    }),

  // Reset password with token
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ input }) => {
      const { token, password } = input;

      // Validate token
      const resetData = resetTokens.get(token);
      if (!resetData || resetData.expires < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired reset token",
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update user password
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.email, resetData.email));

      // Delete used token
      resetTokens.delete(token);

      return {
        success: true,
        message: "Password has been reset successfully",
      };
    }),

  // Get current user profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);

    if (user.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user[0];
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id || !ctx.session?.user?.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const updates: any = {
        ...input,
        updatedAt: new Date(),
      };

      // Check if email is being changed and if it's already taken
      if (input.email && input.email !== ctx.session.user.email) {
        const existingUser = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.email, input.email),
              isNull(users.deletedAt)
            )
          )
          .limit(1);

        if (existingUser.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email is already in use",
          });
        }
      }

      const updatedUser = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, ctx.session.user.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
        });

      return updatedUser[0];
    }),

  // Change password
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const { currentPassword, newPassword } = input;

      // Get current user
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user[0].passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, ctx.session.user.id));

      return {
        success: true,
        message: "Password changed successfully",
      };
    }),

  // Admin: List all users (admin only)
  listUsers: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.session?.user?.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can view all users",
      });
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(users.createdAt);

    return allUsers;
  }),

  // Admin: Update user role or status (admin only)
  updateUser: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "operator", "viewer"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.session?.user?.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update users",
        });
      }

      // Prevent admin from deactivating themselves
      if (input.userId === ctx.session?.user?.id && input.isActive === false) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account",
        });
      }

      const updates: any = {
        updatedAt: new Date(),
      };

      if (input.role !== undefined) updates.role = input.role;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      const updatedUser = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, input.userId))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
        });

      return updatedUser[0];
    }),
});