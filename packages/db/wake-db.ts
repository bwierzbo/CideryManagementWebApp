import postgres from 'postgres';
import { readFileSync } from 'fs';
const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, '');
const sql = postgres(url!, { connect_timeout: 60 });

async function main() {
  try {
    const r = await sql`SELECT 1 as ok`;
    console.log('DB connected:', r[0]);
  } catch (e: any) {
    console.error('Failed:', e.message);
  }
  await sql.end();
}
main();
