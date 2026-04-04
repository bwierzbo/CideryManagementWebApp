import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { batches } from "../schema";

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);

  const result = await db
    .update(batches)
    .set({
      productType: "pommeau",
      status: "aging",
      fermentationStage: "not_applicable",
      actualAbv: "18",
      updatedAt: new Date(),
    })
    .where(eq(batches.id, "61b5a88f-6f70-4d6f-8587-6bb9d592a7a7"))
    .returning({
      id: batches.id,
      customName: batches.customName,
      productType: batches.productType,
      status: batches.status,
      actualAbv: batches.actualAbv,
    });

  console.log("Updated Salish #3:", result);
  await client.end();
}

main().catch(console.error);
