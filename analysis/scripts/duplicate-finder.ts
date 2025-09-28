#!/usr/bin/env tsx

import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

interface FileInfo {
  path: string;
  size: number;
  hash: string;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

async function findDuplicates(baseDir: string): Promise<DuplicateGroup[]> {
  console.log('🔍 Scanning for duplicate files...');

  // Find all files (excluding node_modules and git)
  const files = await glob('**/*', {
    cwd: baseDir,
    ignore: [
      'node_modules/**',
      '.git/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'test-results/**',
      '.next/**',
      '.vercel/**',
      'pnpm-lock.yaml'
    ],
    nodir: true
  });

  const fileMap = new Map<string, FileInfo[]>();

  for (const file of files) {
    const fullPath = join(baseDir, file);
    try {
      const stats = statSync(fullPath);

      // Skip small files and directories
      if (!stats.isFile() || stats.size < 100) continue;

      const content = readFileSync(fullPath);
      const hash = createHash('sha256').update(content).digest('hex');

      const info: FileInfo = {
        path: file,
        size: stats.size,
        hash
      };

      if (!fileMap.has(hash)) {
        fileMap.set(hash, []);
      }
      fileMap.get(hash)!.push(info);
    } catch (error) {
      // Skip files we can't read
      continue;
    }
  }

  // Find duplicates
  const duplicates: DuplicateGroup[] = [];
  for (const [hash, infos] of fileMap.entries()) {
    if (infos.length > 1) {
      duplicates.push({
        hash,
        size: infos[0].size,
        files: infos.map(info => info.path)
      });
    }
  }

  return duplicates;
}

async function main() {
  const baseDir = process.cwd();
  const duplicates = await findDuplicates(baseDir);

  console.log('\n📊 Duplicate Analysis Results:');

  if (duplicates.length === 0) {
    console.log('✅ No duplicate files found!');
  } else {
    console.log(`Found ${duplicates.length} duplicate groups:`);

    let totalWaste = 0;

    for (const group of duplicates) {
      const wastedSpace = group.size * (group.files.length - 1);
      totalWaste += wastedSpace;

      console.log(`\n🔄 Hash: ${group.hash.substring(0, 16)}...`);
      console.log(`   Size: ${(group.size / 1024).toFixed(2)} KB`);
      console.log(`   Wasted: ${(wastedSpace / 1024).toFixed(2)} KB`);
      console.log(`   Files:`);

      for (const file of group.files) {
        console.log(`     - ${file}`);
      }
    }

    console.log(`\n💾 Total potential savings: ${(totalWaste / 1024 / 1024).toFixed(2)} MB`);
  }

  // Output JSON for scripting
  const result = {
    timestamp: new Date().toISOString(),
    tool: 'duplicate-finder',
    duplicateGroups: duplicates,
    summary: {
      totalGroups: duplicates.length,
      totalFiles: duplicates.reduce((sum, group) => sum + group.files.length, 0),
      potentialSavings: duplicates.reduce((sum, group) => sum + (group.size * (group.files.length - 1)), 0)
    }
  };

  console.log('\n' + JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}