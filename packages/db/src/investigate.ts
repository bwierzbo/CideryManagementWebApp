import { db } from "./client";
import { vendors, baseFruitVarieties, vendorVarieties } from "./schema";
import { eq, ilike, isNull, and } from "drizzle-orm";

async function investigate() {
  console.log("🔍 Investigating vendorVariety.attach error...\n");

  try {
    // Check if "Gail Harper" vendor exists
    const gailHarper = await db
      .select()
      .from(vendors)
      .where(ilike(vendors.name, "%Gail Harper%"));

    console.log(`Vendors matching "Gail Harper": ${gailHarper.length}`);
    for (const v of gailHarper) {
      console.log(`  ID: ${v.id}`);
      console.log(`  Name: ${v.name}`);
      console.log(`  Active: ${v.isActive}`);
      console.log("");
    }

    // Check if "Misc" variety exists
    const misc = await db
      .select()
      .from(baseFruitVarieties)
      .where(ilike(baseFruitVarieties.name, "%Misc%"));

    console.log(`\nVarieties matching "Misc": ${misc.length}`);
    for (const v of misc) {
      console.log(`  ID: ${v.id}`);
      console.log(`  Name: ${v.name}`);
      console.log(`  Active: ${v.isActive}`);
      console.log(`  Deleted: ${v.deletedAt ? 'YES' : 'no'}`);
      console.log("");
    }

    // Check if there's already a link between them
    if (gailHarper.length > 0 && misc.length > 0) {
      const existingLink = await db
        .select()
        .from(vendorVarieties)
        .where(
          and(
            eq(vendorVarieties.vendorId, gailHarper[0].id),
            eq(vendorVarieties.varietyId, misc[0].id)
          )
        );

      console.log(`\nExisting links: ${existingLink.length}`);
      for (const link of existingLink) {
        console.log(`  ID: ${link.id}`);
        console.log(`  Deleted: ${link.deletedAt ? 'YES' : 'no'}`);
      }
    }

    // List all varieties to see what exists
    console.log("\n\nAll base fruit varieties:");
    const allVarieties = await db
      .select()
      .from(baseFruitVarieties)
      .where(isNull(baseFruitVarieties.deletedAt));

    for (const v of allVarieties) {
      console.log(`  ${v.name} (${v.id}) - active: ${v.isActive}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

investigate();
