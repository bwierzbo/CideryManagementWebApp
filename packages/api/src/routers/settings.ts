import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { db, systemSettings } from "db";
import { eq } from "drizzle-orm";

/**
 * Settings Router
 * Handles system-wide configuration settings
 */
export const settingsRouter = router({
  /**
   * Get current timezone setting
   * Available to all authenticated users
   */
  getTimezone: protectedProcedure.query(async () => {
    try {
      const setting = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "timezone"))
        .limit(1);

      // Return the timezone value or default to Pacific
      if (setting[0]?.value) {
        // The value is stored as JSONB, so we need to extract the string
        return setting[0].value as string;
      }

      return "America/Los_Angeles";
    } catch (error) {
      console.error("Error fetching timezone:", error);
      return "America/Los_Angeles";
    }
  }),

  /**
   * Update timezone setting
   * Admin only
   */
  updateTimezone: adminProcedure
    .input(
      z.object({
        timezone: z.string().min(1, "Timezone is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Upsert the timezone setting
        await db
          .insert(systemSettings)
          .values({
            key: "timezone",
            value: input.timezone as any,
            updatedAt: new Date(),
            updatedBy: ctx.session.user.id,
          })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              value: input.timezone as any,
              updatedAt: new Date(),
              updatedBy: ctx.session.user.id,
            },
          });

        return {
          success: true,
          message: `Timezone updated to ${input.timezone}`,
        };
      } catch (error) {
        console.error("Error updating timezone:", error);
        throw new Error("Failed to update timezone");
      }
    }),
});

export type SettingsRouter = typeof settingsRouter;
