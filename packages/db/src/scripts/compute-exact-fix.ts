/**
 * Compute the exact For Distillery init that makes Reconciliation Adj = 0.0 gal
 * after the app's rounding (toFixed(1)).
 *
 * Current state:
 *   SBD opening = 4344.661L (all batches except For Distillery contribute 3547.630L)
 *   For Distillery opening = init(387) + transfer(370.3) + adj(39.7) = 797.0L
 *   Non-distillery opening = 4344.661 - 797.0 = 3547.661L
 *
 * Plan: Delete the +39.7L adjustment. New For Distillery opening = newInit + 370.3
 *   New total SBD = 3547.661 + newInit + 370.3 = 3917.961 + newInit
 *   In gallons: (3917.961 + newInit) / 3.78541
 *   Need this to round to 1121.0 after toFixed(1)
 *   So need: 1120.95 <= (3917.961 + newInit) / 3.78541 < 1121.05
 *   => 1120.95 * 3.78541 <= 3917.961 + newInit < 1121.05 * 3.78541
 *   => 4243.25597 <= 3917.961 + newInit < 4243.63397
 *   => 325.295 <= newInit < 325.673
 */

const NON_DISTILLERY_L = 4344.661 - 797.0; // = 3547.661L
const TRANSFER_IN = 370.3;
const CONFIGURED_GAL = 1121.0;
const L_PER_GAL = 3.78541;

console.log("=== COMPUTE EXACT FIX ===\n");
console.log(`Non-distillery SBD opening: ${NON_DISTILLERY_L.toFixed(3)}L`);
console.log(`For Distillery transfer in: ${TRANSFER_IN}L`);
console.log(`Target: configured opening = ${CONFIGURED_GAL} gal\n`);

// Option A: Delete adj, find exact init
console.log("--- Option A: Delete +39.7L adj, adjust init ---");
const targetTotalL_A = CONFIGURED_GAL * L_PER_GAL; // exact target
const neededFromDistillery_A = targetTotalL_A - NON_DISTILLERY_L;
const newInit_A = neededFromDistillery_A - TRANSFER_IN;
const checkTotal_A = NON_DISTILLERY_L + newInit_A + TRANSFER_IN;
const checkGal_A = checkTotal_A / L_PER_GAL;
console.log(`  Target total: ${targetTotalL_A.toFixed(6)}L = ${CONFIGURED_GAL} gal`);
console.log(`  Needed from distillery: ${neededFromDistillery_A.toFixed(6)}L`);
console.log(`  New init: ${newInit_A.toFixed(6)}L`);
console.log(`  Check: total = ${checkTotal_A.toFixed(6)}L = ${checkGal_A.toFixed(6)} gal`);
console.log(`  toFixed(1): ${checkGal_A.toFixed(1)} gal`);
console.log(`  openingDelta: ${(checkGal_A - CONFIGURED_GAL).toFixed(6)} gal → toFixed(1): ${parseFloat((checkGal_A - CONFIGURED_GAL).toFixed(1))} gal`);

// Round init to reasonable precision
const roundedInit_A = Math.round(newInit_A * 10) / 10;
const checkRounded_A = (NON_DISTILLERY_L + roundedInit_A + TRANSFER_IN) / L_PER_GAL;
console.log(`\n  Rounded init: ${roundedInit_A.toFixed(1)}L`);
console.log(`  Check: ${checkRounded_A.toFixed(6)} gal → toFixed(1): ${checkRounded_A.toFixed(1)} gal`);
console.log(`  openingDelta: ${parseFloat((checkRounded_A - CONFIGURED_GAL).toFixed(1))} gal`);

// Option B: Keep adj, adjust init only
console.log("\n--- Option B: Keep +39.7L adj, adjust init only ---");
const neededFromDistillery_B = targetTotalL_A - NON_DISTILLERY_L;
const newInit_B = neededFromDistillery_B - TRANSFER_IN - 39.7;
const checkTotal_B = NON_DISTILLERY_L + newInit_B + TRANSFER_IN + 39.7;
const checkGal_B = checkTotal_B / L_PER_GAL;
console.log(`  New init: ${newInit_B.toFixed(6)}L`);
console.log(`  Check: total = ${checkTotal_B.toFixed(6)}L = ${checkGal_B.toFixed(6)} gal`);
console.log(`  toFixed(1): ${checkGal_B.toFixed(1)} gal`);

const roundedInit_B = Math.round(newInit_B * 10) / 10;
const checkRounded_B = (NON_DISTILLERY_L + roundedInit_B + TRANSFER_IN + 39.7) / L_PER_GAL;
console.log(`  Rounded init: ${roundedInit_B.toFixed(1)}L`);
console.log(`  Check: ${checkRounded_B.toFixed(6)} gal → toFixed(1): ${checkRounded_B.toFixed(1)} gal`);
console.log(`  openingDelta: ${parseFloat((checkRounded_B - CONFIGURED_GAL).toFixed(1))} gal`);

// Show the tolerance window for init (Option A)
console.log("\n--- Tolerance window (Option A) ---");
const minInit = 1120.95 * L_PER_GAL - NON_DISTILLERY_L - TRANSFER_IN;
const maxInit = 1121.05 * L_PER_GAL - NON_DISTILLERY_L - TRANSFER_IN;
console.log(`  Any init in [${minInit.toFixed(3)}, ${maxInit.toFixed(3)}) will round to 1121.0`);
console.log(`  Suggested: ${roundedInit_A.toFixed(1)}L (simplest round number)`);

// Also try nice round numbers
console.log("\n--- Round number options (Option A) ---");
for (const tryInit of [325.0, 325.2, 325.4, 325.5, 325.6, 325.8, 326.0]) {
  const total = (NON_DISTILLERY_L + tryInit + TRANSFER_IN) / L_PER_GAL;
  const delta = parseFloat((total - CONFIGURED_GAL).toFixed(1));
  console.log(`  init=${tryInit.toFixed(1)}L → total=${total.toFixed(4)} gal → toFixed(1)=${total.toFixed(1)} → delta=${delta}`);
}
