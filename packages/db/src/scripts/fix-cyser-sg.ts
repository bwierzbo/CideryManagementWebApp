import "dotenv/config";
import postgres from "postgres";

/**
 * Fix the cyser batch in DRUM-120-10:
 * - The honey addition (13 lbs) didn't create an estimated SG measurement
 *   because the initial measurement had no volume data.
 * - This script creates the missing estimated measurement and updates the batch OG/ABV.
 *
 * Honey is ~80% fermentable sugar by weight.
 * Standard brewing formula: 46 gravity points per lb of sucrose per gallon.
 * For honey: 46 * 0.80 = ~36.8 ppg (aligns with standard 35-38 ppg for honey).
 */

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  // Find the cyser batch in DRUM-120-10
  const batches = await sql`
    SELECT b.id, b.custom_name, b.product_type, b.original_gravity, b.estimated_abv,
           b.current_volume, b.current_volume_unit, b.fermentation_stage
    FROM batches b
    JOIN vessels v ON b.vessel_id = v.id
    WHERE v.name = 'DRUM-120-10' AND b.deleted_at IS NULL
  `;

  if (!batches.length) {
    console.log("No batch found in DRUM-120-10");
    await sql.end();
    return;
  }

  const batch = batches[0];
  console.log("=== Current Batch State ===");
  console.log(`  Name: ${batch.custom_name}`);
  console.log(`  Product Type: ${batch.product_type}`);
  console.log(`  OG: ${batch.original_gravity}`);
  console.log(`  Est ABV: ${batch.estimated_abv}`);
  console.log(`  Volume: ${batch.current_volume} ${batch.current_volume_unit}`);
  console.log(`  Fermentation Stage: ${batch.fermentation_stage}`);

  // Find the honey additive
  const honeyAdditive = await sql`
    SELECT id, additive_name, amount, unit, added_at
    FROM batch_additives
    WHERE batch_id = ${batch.id} AND deleted_at IS NULL
      AND lower(additive_name) LIKE '%honey%'
    ORDER BY added_at
    LIMIT 1
  `;

  if (!honeyAdditive.length) {
    console.log("No honey additive found");
    await sql.end();
    return;
  }

  const honey = honeyAdditive[0];
  console.log(`\n=== Honey Addition ===`);
  console.log(`  ${honey.amount} ${honey.unit} of ${honey.additive_name} at ${honey.added_at}`);

  // Calculate the estimated SG after honey addition
  const GRAMS_PER_POUND = 453.592;
  const LITERS_PER_GALLON = 3.78541;
  const GRAVITY_POINTS_PER_LB_GAL = 0.046; // Sucrose
  const HONEY_SUGAR_CONTENT = 0.80;

  const currentOG = parseFloat(batch.original_gravity);
  const volumeGal = parseFloat(batch.current_volume); // Already in gallons based on unit
  const volumeL = batch.current_volume_unit === "gal" ? volumeGal * LITERS_PER_GALLON : volumeGal;

  // Convert honey to effective sugar grams
  let honeyGrams: number;
  if (honey.unit === "lbs" || honey.unit === "lb") {
    honeyGrams = parseFloat(honey.amount) * GRAMS_PER_POUND;
  } else if (honey.unit === "g") {
    honeyGrams = parseFloat(honey.amount);
  } else if (honey.unit === "kg") {
    honeyGrams = parseFloat(honey.amount) * 1000;
  } else if (honey.unit === "oz") {
    honeyGrams = parseFloat(honey.amount) * 28.3495;
  } else {
    console.log(`Unknown unit: ${honey.unit}`);
    await sql.end();
    return;
  }

  const effectiveSugarGrams = honeyGrams * HONEY_SUGAR_CONTENT;
  const sugarPounds = effectiveSugarGrams / GRAMS_PER_POUND;
  const volumeInGallons = volumeL / LITERS_PER_GALLON;
  const gravityIncrease = (sugarPounds / volumeInGallons) * GRAVITY_POINTS_PER_LB_GAL;

  const newSG = currentOG + gravityIncrease;
  const newEstABV = (newSG - 1.0) * 131.25;

  console.log(`\n=== Calculations ===`);
  console.log(`  Honey: ${honeyGrams.toFixed(0)}g total, ${effectiveSugarGrams.toFixed(0)}g effective sugar (80%)`);
  console.log(`  Volume: ${volumeInGallons.toFixed(1)} gal (${volumeL.toFixed(1)} L)`);
  console.log(`  Gravity increase: ${gravityIncrease.toFixed(4)} (${(gravityIncrease * 1000).toFixed(1)} points)`);
  console.log(`  Current OG: ${currentOG}`);
  console.log(`  New estimated SG: ${newSG.toFixed(4)}`);
  console.log(`  New estimated ABV: ${newEstABV.toFixed(2)}%`);

  // Create the missing estimated measurement
  const addedAt = honey.added_at;
  await sql`
    INSERT INTO batch_measurements (batch_id, measurement_date, specific_gravity, abv, volume, volume_unit, volume_liters, notes, taken_by, is_estimated, estimate_source)
    VALUES (
      ${batch.id},
      ${addedAt},
      ${newSG.toFixed(4)},
      ${newEstABV.toFixed(2)},
      ${volumeL.toFixed(1)},
      'L',
      ${volumeL.toFixed(1)},
      ${"Estimated after adding " + honey.amount + honey.unit + " of " + honey.additive_name + ". Honey ~80% fermentable sugar. Assumes full fermentation."},
      'System (auto-calculated)',
      true,
      'sugar_addition'
    )
  `;
  console.log("\n✅ Created estimated measurement");

  // Update batch OG and estimated ABV
  await sql`
    UPDATE batches
    SET original_gravity = ${newSG.toFixed(4)},
        estimated_abv = ${newEstABV.toFixed(2)},
        updated_at = NOW()
    WHERE id = ${batch.id}
  `;
  console.log("✅ Updated batch OG and estimated ABV");

  await sql.end();
}

main().catch(console.error);
