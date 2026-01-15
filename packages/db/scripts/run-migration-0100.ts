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

// Custom SQL splitter that handles JSONB defaults and DO blocks properly
function splitSqlStatements(sqlContent: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let depth = 0;
  let inDoBlock = false;

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const nextChar = sqlContent[i + 1];

    // Check for DO $$ blocks
    if (!inString && current.toUpperCase().endsWith('DO ') && char === '$' && nextChar === '$') {
      inDoBlock = true;
    }

    // Check for end of DO $$ block
    if (inDoBlock && char === '$' && nextChar === '$') {
      const afterDollar = sqlContent.substring(i + 2, i + 10);
      if (afterDollar.startsWith(';') || afterDollar.trim().startsWith(';')) {
        // End of DO block
        current += '$$';
        i++; // Skip second $
        // Find the semicolon
        while (i + 1 < sqlContent.length && sqlContent[i + 1] !== ';') {
          i++;
          current += sqlContent[i];
        }
        if (sqlContent[i + 1] === ';') {
          i++;
          current += ';';
          const cleaned = stripLeadingComments(current);
          if (cleaned.length > 0) {
            statements.push(cleaned);
          }
          current = "";
          inDoBlock = false;
          continue;
        }
      }
    }

    if ((char === "'" || char === '"') && !inString && !inDoBlock) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      if (char === stringChar && sqlContent[i - 1] !== "\\") {
        if (nextChar === stringChar) {
          current += nextChar;
          i++;
          continue;
        }
        inString = false;
      }
      continue;
    }

    if (!inDoBlock) {
      if (char === "(" || char === "{" || char === "[") {
        depth++;
      } else if (char === ")" || char === "}" || char === "]") {
        depth--;
      }

      if (char === ";" && depth === 0) {
        const cleaned = stripLeadingComments(current);
        if (cleaned.length > 0) {
          statements.push(cleaned);
        }
        current = "";
        continue;
      }
    }

    current += char;
  }

  const cleaned = stripLeadingComments(current);
  if (cleaned.length > 0) {
    statements.push(cleaned);
  }

  return statements;
}

async function run() {
  const migrationPath = path.join(__dirname, "../migrations/0100_tax_reporting_preferences.sql");
  const migration = fs.readFileSync(migrationPath, "utf8");

  console.log("Running migration: 0100_tax_reporting_preferences.sql");

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
