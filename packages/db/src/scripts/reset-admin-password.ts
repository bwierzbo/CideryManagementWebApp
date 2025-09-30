import { db } from "../client";
import { users } from "../schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function resetAdminPassword() {
  console.log("Resetting admin password...");

  try {
    // First, check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "swierzbo@yahoo.com"))
      .limit(1);

    if (!existingUser[0]) {
      console.log("❌ Admin user not found. Creating new admin user...");

      const hashedPassword = await bcrypt.hash("admin123", 10);
      const newUser = await db
        .insert(users)
        .values({
          email: "swierzbo@yahoo.com",
          name: "Admin User",
          passwordHash: hashedPassword,
          role: "admin",
          isActive: true,
        })
        .returning();

      console.log("✅ Admin user created successfully:");
      console.log(`   Email: ${newUser[0].email}`);
      console.log(`   Password: admin123`);
      console.log(`   Role: ${newUser[0].role}`);
    } else {
      console.log("✅ Admin user found. Resetting password...");

      const hashedPassword = await bcrypt.hash("admin123", 10);
      const updated = await db
        .update(users)
        .set({
          passwordHash: hashedPassword,
          isActive: true,
        })
        .where(eq(users.email, "swierzbo@yahoo.com"))
        .returning();

      console.log("✅ Password reset successfully:");
      console.log(`   Email: ${updated[0].email}`);
      console.log(`   Password: admin123`);
      console.log(`   Role: ${updated[0].role}`);
      console.log(`   Active: ${updated[0].isActive}`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

resetAdminPassword();