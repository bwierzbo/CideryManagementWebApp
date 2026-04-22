/**
 * Create finalized TTB period snapshots for 2024 and 2025
 * using the official numbers filed with TTB.
 *
 * Source: Filed TTB Form 5120.17 (2024 filed 1/13/2025, 2025 filed 2/27/2026)
 * These snapshots are IMMUTABLE once finalized.
 *
 * The system's getBeginningInventory() uses finalized snapshots as priority 1
 * for determining opening balances. After running this script:
 * - 2025 opening = 2024 snapshot ending (1,121 gal)
 * - 2026 opening = 2025 snapshot ending (4,295 gal)
 */
import postgres from 'postgres';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const sql = postgres(url!, { connect_timeout: 60 });

async function main() {
  console.log('=== Creating TTB Period Snapshots ===\n');

  // Get admin user ID for audit trail
  const [admin] = await sql`SELECT id FROM users LIMIT 1`;
  const adminId = admin.id;

  // ─── 2024 Snapshot ───
  // Filed 1/13/2025. First year of production.
  // Bulk ending: Wine≤16=0, Wine16-21=60, HC=1061
  // Bottled ending: all 0
  // Spirits: apple brandy 18 PG
  console.log('Creating 2024 annual snapshot...');

  const [snapshot2024] = await sql`
    INSERT INTO ttb_period_snapshots (
      period_type, period_start, period_end, year,
      -- Bulk ending inventory (wine gallons)
      bulk_hard_cider, bulk_wine_under_16, bulk_wine_16_to_21,
      bulk_wine_21_to_24, bulk_sparkling_wine, bulk_carbonated_wine,
      -- Bottled ending inventory (wine gallons)
      bottled_hard_cider, bottled_wine_under_16, bottled_wine_16_to_21,
      bottled_wine_21_to_24, bottled_sparkling_wine, bottled_carbonated_wine,
      -- Spirits (proof gallons)
      spirits_apple_brandy, spirits_grape, spirits_other,
      -- Production during period
      produced_hard_cider, produced_wine_under_16, produced_wine_16_to_21,
      -- Tax-paid removals
      taxpaid_tasting_room, taxpaid_wholesale, taxpaid_online_dtc, taxpaid_events, taxpaid_other,
      -- Other removals
      removed_samples, removed_breakage, removed_process_loss, removed_distilling,
      -- Materials
      materials_apples_lbs, materials_other_fruit_lbs, materials_juice_gallons, materials_sugar_lbs,
      -- Tax
      tax_hard_cider, tax_wine_under_16, tax_wine_16_to_21,
      tax_small_producer_credit, tax_total,
      -- Status
      status, finalized_at, finalized_by,
      notes, created_by
    ) VALUES (
      'annual', '2024-01-01', '2024-12-31', 2024,
      -- Bulk: HC=1061, Wine≤16=0, Wine16-21=60 (pommeau)
      1061, 0, 60, 0, 0, 0,
      -- Bottled: all 0
      0, 0, 0, 0, 0, 0,
      -- Spirits: 18 PG apple brandy
      18, 0, 0,
      -- Production: HC=1496, Wine≤16=127 (berry cider), Wine16-21=60 (pommeau)
      1496, 127, 60,
      -- Tax-paid removals: 127 gal wine (kegs) + 90 gal HC (bottles)
      -- All through tasting room
      217, 0, 0, 0, 0,
      -- Other removals: distilling 264 gal, losses 39 gal
      0, 0, 39, 264,
      -- Materials: 20140 lbs apples, 112 lbs berries
      20140, 112, 0, 0,
      -- Tax: HC 90×$0.226=$20.34, Wine 127×$0.17=$21.59, total $41.93
      20.34, 21.59, 0, 0, 41.93,
      -- Finalized
      'finalized', NOW(), ${adminId},
      'Official TTB Form 5120.17 as filed 1/13/2025. First year of production.',
      ${adminId}
    ) RETURNING id
  `;
  console.log('  ✅ 2024 snapshot created:', snapshot2024.id);

  // ─── 2025 Snapshot ───
  // Filed 2/27/2026.
  // Bulk ending: Wine≤16=17, Wine16-21=123, HC=4093
  // Bottled ending: Wine≤16=62
  // Spirits: apple brandy 25 PG
  console.log('Creating 2025 annual snapshot...');

  const [snapshot2025] = await sql`
    INSERT INTO ttb_period_snapshots (
      period_type, period_start, period_end, year,
      -- Bulk ending inventory (wine gallons)
      bulk_hard_cider, bulk_wine_under_16, bulk_wine_16_to_21,
      bulk_wine_21_to_24, bulk_sparkling_wine, bulk_carbonated_wine,
      -- Bottled ending inventory (wine gallons)
      bottled_hard_cider, bottled_wine_under_16, bottled_wine_16_to_21,
      bottled_wine_21_to_24, bottled_sparkling_wine, bottled_carbonated_wine,
      -- Spirits (proof gallons)
      spirits_apple_brandy, spirits_grape, spirits_other,
      -- Production during period
      produced_hard_cider, produced_wine_under_16, produced_wine_16_to_21,
      -- Tax-paid removals
      taxpaid_tasting_room, taxpaid_wholesale, taxpaid_online_dtc, taxpaid_events, taxpaid_other,
      -- Other removals
      removed_samples, removed_breakage, removed_process_loss, removed_distilling,
      -- Materials
      materials_apples_lbs, materials_other_fruit_lbs, materials_juice_gallons, materials_sugar_lbs,
      -- Tax
      tax_hard_cider, tax_wine_under_16, tax_wine_16_to_21,
      tax_small_producer_credit, tax_total,
      -- Status
      status, finalized_at, finalized_by,
      notes, created_by
    ) VALUES (
      'annual', '2025-01-01', '2025-12-31', 2025,
      -- Bulk: HC=4093, Wine≤16=17, Wine16-21=123
      4093, 17, 123, 0, 0, 0,
      -- Bottled: Wine≤16=62
      0, 62, 0, 0, 0, 0,
      -- Spirits: 25 PG apple brandy
      25, 0, 0,
      -- Production: HC=4808, Wine≤16=0 (came from tax class change), Wine16-21=119 (pommeau)
      4808, 0, 119,
      -- Tax-paid removals: Wine≤16=566, Wine16-21=55, HC=149 = 770 total
      770, 0, 0, 0, 0,
      -- Other removals: distilling 758 gal, losses 281 gal
      0, 0, 281, 758,
      -- Materials: 63299 lbs apples, 786 lbs berries, 100 lbs other
      63299, 886, 0, 0,
      -- Tax: $727.78 (filed at full rates for wine + HC rate)
      33.67, 605.62, 86.35, 0, 727.78,
      -- Finalized
      'finalized', NOW(), ${adminId},
      'Official TTB Form 5120.17 as filed 2/27/2026. Includes tax class change corrections (Lines 10/24) and 2024 mislabel correction (Section B Line 15).',
      ${adminId}
    ) RETURNING id
  `;
  console.log('  ✅ 2025 snapshot created:', snapshot2025.id);

  // ─── Lock Years ───
  console.log('\nLocking 2024 and 2025...');
  await sql`
    UPDATE organization_settings
    SET reconciliation_locked_years = '[2024, 2025]'::jsonb
    WHERE id = (SELECT id FROM organization_settings LIMIT 1)
  `;
  console.log('  ✅ Years 2024 and 2025 locked');

  // ─── Verify ───
  console.log('\n=== Verification ===');

  const snapshots = await sql`
    SELECT year, period_type, status,
           CAST(bulk_hard_cider AS numeric) + CAST(bulk_wine_under_16 AS numeric) + CAST(bulk_wine_16_to_21 AS numeric) as bulk_total,
           CAST(bottled_hard_cider AS numeric) + CAST(bottled_wine_under_16 AS numeric) + CAST(bottled_wine_16_to_21 AS numeric) as bottled_total,
           spirits_apple_brandy
    FROM ttb_period_snapshots
    ORDER BY year
  `;
  for (const s of snapshots) {
    const total = Number(s.bulk_total) + Number(s.bottled_total);
    console.log(`  ${s.year} ${s.period_type} (${s.status}): bulk=${Number(s.bulk_total).toFixed(0)} + bottled=${Number(s.bottled_total).toFixed(0)} = ${total.toFixed(0)} gal, spirits=${s.spirits_apple_brandy} PG`);
  }

  const [settings] = await sql`SELECT reconciliation_locked_years FROM organization_settings LIMIT 1`;
  console.log(`  Locked years: ${JSON.stringify(settings.reconciliation_locked_years)}`);

  console.log('\n2026 opening should now use 2025 snapshot ending: 4,295 gal');
  console.log('Run the app and check getBeginningInventory for 2026 to confirm.');

  await sql.end();
}
main().catch(e => { console.error(e); process.exit(1); });
