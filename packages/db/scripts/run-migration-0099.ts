import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Vp9dbKcf2YRN@ep-super-smoke-adgofb1l-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(DATABASE_URL);

// Remove leading comment lines and extract the actual SQL
function stripLeadingComments(sql: string): string {
  const lines = sql.split('\n');
  let resultLines: string[] = [];
  let foundNonComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (foundNonComment || (trimmed.length > 0 && !trimmed.startsWith('--'))) {
      foundNonComment = true;
      resultLines.push(line);
    }
  }

  return resultLines.join('\n').trim();
}

// Custom SQL splitter that handles JSONB defaults properly
function splitSqlStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let depth = 0; // Track nested brackets/braces

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = sqlContent[i + 1];

    // Handle string literals
    if ((char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      // Handle escaped quotes
      if (char === stringChar && sqlContent[i - 1] !== "\\") {
        // Check for doubled quotes (SQL escape)
        if (nextChar === stringChar) {
          current += nextChar;
          i++;
          continue;
        }
        inString = false;
      }
      continue;
    }

    // Track bracket depth (for JSONB)
    if (char === "(" || char === "{" || char === "[") {
      depth++;
    } else if (char === ")" || char === "}" || char === "]") {
      depth--;
    }

    // Only split on semicolons at depth 0 and outside strings
    if (char === ";" && depth === 0) {
      const cleaned = stripLeadingComments(current);
      if (cleaned.length > 0) {
        statements.push(cleaned);
      }
      current = "";
      continue;
    }

    current += char;
  }

  // Add final statement if any
  const cleaned = stripLeadingComments(current);
  if (cleaned.length > 0) {
    statements.push(cleaned);
  }

  return statements;
}

async function run() {
  const migrationPath = path.join(__dirname, "../migrations/0099_ttb_period_snapshots.sql");
  const migration = fs.readFileSync(migrationPath, "utf8");

  console.log("Running migration: 0099_ttb_period_snapshots.sql");

  const statements = splitSqlStatements(migration);

  console.log(`Found ${statements.length} statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt) {
      try {
        await sql.unsafe(stmt);
        console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err.message?.includes("already exists") || err.message?.includes("duplicate key")) {
          console.log(`⚠ Statement ${i + 1}/${statements.length} skipped (already exists)`);
        } else {
          console.log(`✗ Statement ${i + 1}/${statements.length} failed:`);
          console.log("  SQL:", stmt.substring(0, 100) + (stmt.length > 100 ? "..." : ""));
          console.log("  Error:", err.message);
        }
      }
    }
  }
  console.log("\n✅ Migration complete!");
  await sql.end();
}

run().catch(console.error);
