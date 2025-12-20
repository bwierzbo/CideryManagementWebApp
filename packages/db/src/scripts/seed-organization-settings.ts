/**
 * Seed Organization Settings
 *
 * This script updates the default organization settings with your cidery preferences.
 *
 * Run with: pnpm --filter db run db:seed-settings
 */

import "dotenv/config";
import postgres from "postgres";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

async function seedOrganizationSettings() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(connectionString);

  console.log("Updating organization settings...");

  try {
    // First ensure the organization exists
    await client`
      INSERT INTO organizations (id, name)
      VALUES (${DEFAULT_ORG_ID}, 'My Cidery')
      ON CONFLICT (id) DO NOTHING
    `;

    // Check if settings exist
    const existing = await client`
      SELECT id FROM organization_settings
      WHERE organization_id = ${DEFAULT_ORG_ID}
    `;

    if (existing.length === 0) {
      // Insert new settings
      await client`
        INSERT INTO organization_settings (
          organization_id,
          name,
          fruit_source,
          production_scale,
          product_types,
          fruit_purchases_enabled,
          press_runs_enabled,
          juice_purchases_enabled,
          barrel_aging_enabled,
          carbonation_enabled,
          bottle_conditioning_enabled,
          kegging_enabled,
          bottling_enabled,
          canning_enabled,
          ttb_reporting_enabled,
          spirits_inventory_enabled,
          package_types,
          carbonation_methods,
          default_target_co2,
          stalled_batch_days,
          long_aging_days,
          low_inventory_threshold,
          ttb_reminder_days,
          volume_units,
          volume_show_secondary,
          weight_units,
          weight_show_secondary,
          temperature_units,
          temperature_show_secondary,
          density_units,
          density_show_secondary,
          pressure_units,
          pressure_show_secondary,
          date_format,
          time_format,
          theme,
          default_currency
        ) VALUES (
          ${DEFAULT_ORG_ID},
          'My Cidery',
          ARRAY['orchard', 'purchase_fruit'],
          'small',
          ARRAY['cider', 'perry', 'fortified'],
          true,
          true,
          true,
          true,
          true,
          false,
          true,
          true,
          false,
          true,
          true,
          ARRAY['bottle', 'keg'],
          ARRAY['forced'],
          2.70,
          14,
          90,
          24,
          7,
          'gallons',
          false,
          'pounds',
          false,
          'fahrenheit',
          false,
          'sg',
          false,
          'psi',
          false,
          'mdy',
          '12h',
          'system',
          'USD'
        )
      `;
      console.log("Created new organization settings");
    } else {
      // Update existing settings
      await client`
        UPDATE organization_settings
        SET
          name = 'My Cidery',
          fruit_source = ARRAY['orchard', 'purchase_fruit'],
          production_scale = 'small',
          product_types = ARRAY['cider', 'perry', 'fortified'],
          fruit_purchases_enabled = true,
          press_runs_enabled = true,
          juice_purchases_enabled = true,
          barrel_aging_enabled = true,
          carbonation_enabled = true,
          bottle_conditioning_enabled = false,
          kegging_enabled = true,
          bottling_enabled = true,
          canning_enabled = false,
          ttb_reporting_enabled = true,
          spirits_inventory_enabled = true,
          package_types = ARRAY['bottle', 'keg'],
          carbonation_methods = ARRAY['forced'],
          default_target_co2 = 2.70,
          stalled_batch_days = 14,
          long_aging_days = 90,
          low_inventory_threshold = 24,
          ttb_reminder_days = 7,
          volume_units = 'gallons',
          volume_show_secondary = false,
          weight_units = 'pounds',
          weight_show_secondary = false,
          temperature_units = 'fahrenheit',
          temperature_show_secondary = false,
          density_units = 'sg',
          density_show_secondary = false,
          pressure_units = 'psi',
          pressure_show_secondary = false,
          date_format = 'mdy',
          time_format = '12h',
          theme = 'system',
          default_currency = 'USD',
          updated_at = NOW()
        WHERE organization_id = ${DEFAULT_ORG_ID}
      `;
      console.log("Updated existing organization settings");
    }

    // Verify
    const settings = await client`
      SELECT name, fruit_source, product_types, volume_units, date_format
      FROM organization_settings
      WHERE organization_id = ${DEFAULT_ORG_ID}
    `;

    console.log("\nCurrent settings:");
    console.log(JSON.stringify(settings[0], null, 2));
    console.log("\nOrganization settings seeded successfully!");
  } catch (error) {
    console.error("Error seeding organization settings:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedOrganizationSettings();
