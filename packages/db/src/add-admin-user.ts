import { db } from "./client";
import { users } from "./schema";
import bcrypt from "bcryptjs";

async function addAdminUser() {
  console.log("Adding admin user...");

  try {
    const hashedPassword = await bcrypt.hash("Fynnhaven24!", 10);

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
    console.log(`   Role: ${newUser[0].role}`);
    console.log(`   ID: ${newUser[0].id}`);
  } catch (error) {
    console.error("❌ Error creating user:", error);
    process.exit(1);
  }

  process.exit(0);
}

addAdminUser();