#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface UnusedExport {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface';
  file: string;
  line: number;
  column: number;
}

interface UnusedExportType {
  name: string;
  type: 'interface' | 'type';
  file: string;
  line: number;
  column: number;
}

async function parseKnipOutput(): Promise<{ exports: UnusedExport[], types: UnusedExportType[] }> {
  console.log('🔍 Running knip analysis...');

  try {
    const knipOutput = execSync('pnpm analysis:dead-code', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    const exports: UnusedExport[] = [];
    const types: UnusedExportType[] = [];

    const lines = knipOutput.split('\n');
    let inExportsSection = false;
    let inTypesSection = false;

    for (const line of lines) {
      if (line.includes('Unused exports')) {
        inExportsSection = true;
        inTypesSection = false;
        continue;
      }

      if (line.includes('Unused exported types')) {
        inExportsSection = false;
        inTypesSection = true;
        continue;
      }

      if (line.includes('Configuration hints')) {
        inExportsSection = false;
        inTypesSection = false;
        break;
      }

      if (inExportsSection && line.trim()) {
        const match = line.match(/^(\w+)\s+(function|class|variable)?\s*(.+):(\d+):(\d+)$/);
        if (match) {
          exports.push({
            name: match[1],
            type: (match[2] as any) || 'variable',
            file: match[3].trim(),
            line: parseInt(match[4]),
            column: parseInt(match[5])
          });
        }
      }

      if (inTypesSection && line.trim()) {
        const match = line.match(/^(\w+)\s+(interface|type)\s+(.+):(\d+):(\d+)$/);
        if (match) {
          types.push({
            name: match[1],
            type: match[2] as 'interface' | 'type',
            file: match[3].trim(),
            line: parseInt(match[4]),
            column: parseInt(match[5])
          });
        }
      }
    }

    return { exports, types };
  } catch (error) {
    console.error('Error running knip:', error);
    return { exports: [], types: [] };
  }
}

function removeExportFromFile(filePath: string, exportName: string, line: number): boolean {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Try to find and remove the export
    const targetLine = lines[line - 1]; // knip uses 1-based line numbers

    if (!targetLine) return false;

    // Handle different export patterns
    const patterns = [
      new RegExp(`^export\\s+(const|let|var|function|class|interface|type)\\s+${exportName}`),
      new RegExp(`^export\\s+\\{[^}]*${exportName}[^}]*\\}`),
      new RegExp(`^export\\s+${exportName}`),
      new RegExp(`^export.*${exportName}`)
    ];

    let modified = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of patterns) {
        if (pattern.test(line)) {
          // If it's a simple export statement, remove the entire line
          if (line.trim().startsWith('export') && line.includes(exportName)) {
            console.log(`  Removing line ${i + 1}: ${line.trim()}`);
            lines.splice(i, 1);
            modified = true;
            break;
          }
        }
      }

      if (modified) break;
    }

    if (modified) {
      writeFileSync(filePath, lines.join('\n'));
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

async function main() {
  const baseDir = process.cwd();
  const { exports, types } = await parseKnipOutput();

  console.log(`\n📊 Found ${exports.length} unused exports and ${types.length} unused types`);

  let removedCount = 0;

  // Process unused exports
  for (const exp of exports) {
    const fullPath = join(baseDir, exp.file);
    console.log(`\n🔧 Processing ${exp.name} in ${exp.file}`);

    if (removeExportFromFile(fullPath, exp.name, exp.line)) {
      removedCount++;
      console.log(`  ✅ Removed ${exp.name}`);
    } else {
      console.log(`  ⚠️  Could not remove ${exp.name}`);
    }
  }

  // Process unused types
  for (const type of types) {
    const fullPath = join(baseDir, type.file);
    console.log(`\n🔧 Processing type ${type.name} in ${type.file}`);

    if (removeExportFromFile(fullPath, type.name, type.line)) {
      removedCount++;
      console.log(`  ✅ Removed type ${type.name}`);
    } else {
      console.log(`  ⚠️  Could not remove type ${type.name}`);
    }
  }

  console.log(`\n🎉 Successfully removed ${removedCount} unused exports/types`);
  console.log(`\n💡 Re-run 'pnpm analysis:dead-code' to verify cleanup`);
}

if (require.main === module) {
  main().catch(console.error);
}