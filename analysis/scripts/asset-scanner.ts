import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';
import { glob } from 'glob';

interface AssetFile {
  path: string;
  size: number;
  type: 'image' | 'font' | 'icon' | 'css' | 'js' | 'other';
  isReferenced: boolean;
  references: string[];
}

interface AssetAnalysisResult {
  timestamp: string;
  tool: 'asset-scanner';
  totalAssets: number;
  unusedAssets: AssetFile[];
  largeAssets: AssetFile[];
  duplicateAssets: AssetFile[][];
  summary: {
    totalSize: number;
    unusedSize: number;
    potentialSavings: number;
    unusedCount: number;
  };
}

export class AssetScanner {
  private rootDir: string;
  private sourcePatterns: string[];
  private assetPatterns: string[];

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.sourcePatterns = [
      'apps/web/src/**/*.{ts,tsx,js,jsx}',
      'apps/web/src/**/*.css',
      'apps/web/src/**/*.scss',
      'packages/**/src/**/*.{ts,tsx,js,jsx}',
      'apps/web/app/**/*.{ts,tsx,js,jsx}',
      'apps/web/pages/**/*.{ts,tsx,js,jsx}'
    ];
    this.assetPatterns = [
      'apps/web/public/**/*.{png,jpg,jpeg,gif,svg,ico,webp}',
      'apps/web/public/**/*.{woff,woff2,ttf,eot}',
      'apps/web/src/**/*.{png,jpg,jpeg,gif,svg,ico,webp}',
      'apps/web/src/**/*.{woff,woff2,ttf,eot}'
    ];
  }

  async scan(): Promise<AssetAnalysisResult> {
    console.log('🔍 Scanning assets...');

    const assets = await this.findAssets();
    const sourceFiles = await this.findSourceFiles();
    const sourceContent = await this.readSourceFiles(sourceFiles);

    const analyzedAssets = await this.analyzeAssetUsage(assets, sourceContent);
    const largeAssets = this.findLargeAssets(analyzedAssets);
    const duplicateAssets = await this.findDuplicateAssets(analyzedAssets);

    const unusedAssets = analyzedAssets.filter(asset => !asset.isReferenced);
    const totalSize = analyzedAssets.reduce((sum, asset) => sum + asset.size, 0);
    const unusedSize = unusedAssets.reduce((sum, asset) => sum + asset.size, 0);

    return {
      timestamp: new Date().toISOString(),
      tool: 'asset-scanner',
      totalAssets: analyzedAssets.length,
      unusedAssets,
      largeAssets,
      duplicateAssets,
      summary: {
        totalSize,
        unusedSize,
        potentialSavings: unusedSize,
        unusedCount: unusedAssets.length
      }
    };
  }

  private async findAssets(): Promise<string[]> {
    const assets: string[] = [];

    for (const pattern of this.assetPatterns) {
      const files = await glob(pattern, { cwd: this.rootDir });
      assets.push(...files);
    }

    return [...new Set(assets)];
  }

  private async findSourceFiles(): Promise<string[]> {
    const sources: string[] = [];

    for (const pattern of this.sourcePatterns) {
      const files = await glob(pattern, { cwd: this.rootDir });
      sources.push(...files);
    }

    return [...new Set(sources)];
  }

  private async readSourceFiles(sourceFiles: string[]): Promise<string> {
    let content = '';

    for (const file of sourceFiles) {
      try {
        const fullPath = join(this.rootDir, file);
        const fileContent = await readFile(fullPath, 'utf-8');
        content += fileContent + '\n';
      } catch (error) {
        console.warn(`Warning: Could not read ${file}:`, error);
      }
    }

    return content;
  }

  private async analyzeAssetUsage(assetPaths: string[], sourceContent: string): Promise<AssetFile[]> {
    const results: AssetFile[] = [];

    for (const assetPath of assetPaths) {
      const fullPath = join(this.rootDir, assetPath);

      try {
        const stats = await stat(fullPath);
        const filename = assetPath.split('/').pop() || '';
        const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');

        // Check for references
        const references = this.findAssetReferences(assetPath, filename, filenameWithoutExt, sourceContent);

        results.push({
          path: assetPath,
          size: stats.size,
          type: this.getAssetType(assetPath),
          isReferenced: references.length > 0,
          references
        });
      } catch (error) {
        console.warn(`Warning: Could not analyze ${assetPath}:`, error);
      }
    }

    return results;
  }

  private findAssetReferences(assetPath: string, filename: string, filenameWithoutExt: string, sourceContent: string): string[] {
    const references: string[] = [];
    const patterns = [
      // Direct file references
      new RegExp(`['"\`]([^'"\`]*${filename})['\"\`]`, 'g'),
      new RegExp(`['"\`]([^'"\`]*${filenameWithoutExt})['\"\`]`, 'g'),
      // Import statements
      new RegExp(`import.*['"\`]([^'"\`]*${filename})['\"\`]`, 'g'),
      new RegExp(`import.*['"\`]([^'"\`]*${filenameWithoutExt})['\"\`]`, 'g'),
      // Require statements
      new RegExp(`require\\(['"\`]([^'"\`]*${filename})['\"\`]\\)`, 'g'),
      new RegExp(`require\\(['"\`]([^'"\`]*${filenameWithoutExt})['\"\`]\\)`, 'g'),
      // CSS url() references
      new RegExp(`url\\(['"\`]?([^'"\`()]*${filename})['\"\`]?\\)`, 'g'),
      // Next.js Image src
      new RegExp(`src=['"\`]([^'"\`]*${filename})['\"\`]`, 'g'),
      // Background images
      new RegExp(`background-image:.*url\\(['"\`]?([^'"\`()]*${filename})['\"\`]?\\)`, 'g')
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(sourceContent)) !== null) {
        references.push(match[1] || match[0]);
      }
    }

    return [...new Set(references)];
  }

  private getAssetType(path: string): AssetFile['type'] {
    const ext = extname(path).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
      return 'image';
    }
    if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      return 'font';
    }
    if (['.css', '.scss', '.sass'].includes(ext)) {
      return 'css';
    }
    if (['.js', '.mjs'].includes(ext)) {
      return 'js';
    }

    return 'other';
  }

  private findLargeAssets(assets: AssetFile[], threshold: number = 100 * 1024): AssetFile[] {
    return assets
      .filter(asset => asset.size > threshold)
      .sort((a, b) => b.size - a.size);
  }

  private async findDuplicateAssets(assets: AssetFile[]): Promise<AssetFile[][]> {
    const sizeGroups = new Map<number, AssetFile[]>();

    // Group by size first (quick filter)
    for (const asset of assets) {
      if (!sizeGroups.has(asset.size)) {
        sizeGroups.set(asset.size, []);
      }
      sizeGroups.get(asset.size)!.push(asset);
    }

    const duplicates: AssetFile[][] = [];

    // Check for actual content duplicates within size groups
    for (const [size, group] of sizeGroups) {
      if (group.length > 1 && size > 0) {
        // For now, assume same size = duplicate (could enhance with content hashing)
        duplicates.push(group);
      }
    }

    return duplicates;
  }
}

// CLI interface
if (require.main === module) {
  async function main() {
    const rootDir = process.cwd();
    const scanner = new AssetScanner(rootDir);

    try {
      const result = await scanner.scan();

      console.log('\n📊 Asset Analysis Results:');
      console.log(`Total assets: ${result.totalAssets}`);
      console.log(`Unused assets: ${result.summary.unusedCount}`);
      console.log(`Total size: ${(result.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Unused size: ${(result.summary.unusedSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Potential savings: ${(result.summary.potentialSavings / 1024 / 1024).toFixed(2)} MB`);

      // Output JSON for programmatic use
      console.log('\n' + JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Asset scanning failed:', error);
      process.exit(1);
    }
  }

  main();
}