import { db } from "../client";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Apply migration
  const migrationPath = path.resolve(
    __dirname,
    "../../migrations/0126_additive_volume_contribution.sql",
  );
  const sqlText = fs.readFileSync(migrationPath, "utf-8");
  await db.execute(sql.raw(sqlText));
  console.log("Migration 0126 applied.");

  // Seed default volume contributions
  const seeds = [
    { type: "Sugar & Sweeteners", pattern: "honey",       density: "1.420", label: "Honey",                       notes: "Typical density 1.40-1.45 kg/L; varies by water content", sort: 10 },
    { type: "Sugar & Sweeteners", pattern: "syrup",       density: "1.330", label: "Sugar syrup",                 notes: "Heavy simple syrup ~67% sugar",                            sort: 20 },
    { type: "Sugar & Sweeteners", pattern: "concentrate", density: "1.300", label: "Juice concentrate",           notes: "Apple/pear juice concentrate ~70 brix",                    sort: 30 },
    { type: "Fruit/Fruit Product", pattern: null,         density: "1.000", label: "Fruit / fruit product",       notes: "Approximate water density; override per ingredient if needed", sort: 40 },
    { type: "Flavorings & Adjuncts", pattern: "brandy",   density: "0.940", label: "Brandy / spirits at ~40% ABV", notes: "Density depends on ABV: 40% ABV is about 0.94, 50% is 0.93, 60% is 0.92", sort: 50 },
    { type: "Flavorings & Adjuncts", pattern: "spirit",   density: "0.940", label: "Spirits, generic",            notes: "Same as brandy default; override per spirit if known",      sort: 51 },
  ];
  for (const s of seeds) {
    await db.execute(sql`
      INSERT INTO additive_volume_defaults
        (additive_type, name_pattern, density_kg_per_l, display_label, notes, sort_order)
      VALUES (${s.type}, ${s.pattern}, ${s.density}, ${s.label}, ${s.notes}, ${s.sort})
    `);
  }
  console.log(`Seeded ${seeds.length} volume defaults.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
