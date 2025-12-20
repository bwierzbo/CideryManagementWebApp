import { db } from "./src/client";
import { pressRuns, batches, vessels, batchTransfers } from "./src/schema";
import { eq, or, desc } from "drizzle-orm";

async function check() {
  const pressRunId = 'fb46656a-4e2f-4d2d-85a7-03276c073668';
  
  console.log('Press Run 2025-09-17-01:');
  console.log('- Total juice: 810 L');
  console.log('- Target vessel: NULL (unknown)');
  
  // Find batches created from this press run
  const batchesFromPress = await db.select({
    id: batches.id,
    name: batches.name,
    vesselId: batches.vesselId,
    status: batches.status,
    initialVolume: batches.initialVolume,
    createdAt: batches.createdAt,
  })
  .from(batches)
  .where(eq(batches.originPressRunId, pressRunId));
  
  console.log('\nBatches from this press run:', JSON.stringify(batchesFromPress, null, 2));

  // Get vessel details for each batch
  for (const batch of batchesFromPress) {
    if (batch.vesselId) {
      const vessel = await db.select({
        id: vessels.id,
        name: vessels.name,
      }).from(vessels).where(eq(vessels.id, batch.vesselId));
      console.log(`\nBatch "${batch.name}" (${batch.initialVolume}L) is currently in vessel:`, vessel[0]?.name);
    } else {
      console.log(`\nBatch "${batch.name}" has NO vessel assigned currently`);
    }
  }

  // Check batch transfers to find original vessel
  console.log('\n--- Checking transfer history ---');
  for (const batch of batchesFromPress) {
    const transfers = await db.select({
      fromVesselId: batchTransfers.fromVesselId,
      toVesselId: batchTransfers.toVesselId,
      transferDate: batchTransfers.transferDate,
      volume: batchTransfers.volume,
    })
    .from(batchTransfers)
    .where(eq(batchTransfers.batchId, batch.id))
    .orderBy(batchTransfers.transferDate);
    
    if (transfers.length > 0) {
      console.log(`\nTransfers for "${batch.name}":`);
      for (const t of transfers) {
        const fromVessel = t.fromVesselId ? 
          (await db.select({name: vessels.name}).from(vessels).where(eq(vessels.id, t.fromVesselId)))[0]?.name : 'Unknown';
        const toVessel = t.toVesselId ?
          (await db.select({name: vessels.name}).from(vessels).where(eq(vessels.id, t.toVesselId)))[0]?.name : 'Unknown';
        console.log(`  ${t.transferDate}: ${fromVessel} -> ${toVessel} (${t.volume}L)`);
      }
    }
  }

  process.exit(0);
}
check();
