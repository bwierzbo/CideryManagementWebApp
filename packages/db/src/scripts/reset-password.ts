import { db } from "../client";
import { users } from "../schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error("❌ Usage: npx tsx reset-password.ts <email> <new-password>");
    console.error("   Example: npx tsx reset-password.ts user@example.com newPass123");
    process.exit(1);
  }

  console.log(`🔐 Resetting password for: ${email}`);

  try {
    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser[0]) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updated = await db
      .update(users)
      .set({
        passwordHash: hashedPassword,
        isActive: true,
      })
      .where(eq(users.email, email))
      .returning();

    console.log("✅ Password reset successfully!");
    console.log(`   Email: ${updated[0].email}`);
    console.log(`   Role: ${updated[0].role}`);
    console.log(`   Active: ${updated[0].isActive}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

resetPassword();
