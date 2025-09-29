#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join, dirname, resolve, relative, extname } from 'path';
import { glob } from 'glob';

interface AssetReference {
  path: string;
  referencedBy: string[];
  type: 'image' | 'css' | 'js' | 'font' | 'other';
  size?: number;
}

interface AssetAnalysis {
  totalAssets: number;
  usedAssets: number;
  unusedAssets: AssetReference[];
  potentiallyUnused: AssetReference[];
  largeAssets: AssetReference[];
  analysisDate: string;
  errors: string[];
}

class AssetScanner {
  private readonly rootDir: string;
  private readonly webAppDir: string;
  private readonly publicDir: string;
  private assetReferences = new Map<string, AssetReference>();
  private errors: string[] = [];

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.webAppDir = join(rootDir, 'apps/web');
    this.publicDir = join(this.webAppDir, 'public');
  }

  async scanAssets(): Promise<AssetAnalysis> {
    console.log('🔍 Starting asset usage analysis...');

    try {
      // Discover all assets
      await this.discoverAssets();

      // Scan source files for asset references
      await this.scanSourceFiles();

      // Analyze Next.js specific patterns
      await this.scanNextJsPatterns();

      // Generate analysis
      return this.generateAnalysis();
    } catch (error) {
      this.errors.push(`Asset scanning failed: ${error}`);
      return this.generateAnalysis();
    }
  }

  private async discoverAssets(): Promise<void> {
    console.log('📂 Discovering assets...');

    // Scan public directory
    if (await this.directoryExists(this.publicDir)) {
      const publicAssets = await glob('**/*', { cwd: this.publicDir, nodir: true });

      for (const assetPath of publicAssets) {
        const fullPath = join(this.publicDir, assetPath);
        const relativePath = `/${assetPath}`;

        try {
          const stats = await fs.stat(fullPath);
          this.assetReferences.set(relativePath, {
            path: relativePath,
            referencedBy: [],
            type: this.getAssetType(assetPath),
            size: stats.size
          });
        } catch (error) {
          this.errors.push(`Failed to stat asset ${relativePath}: ${error}`);
        }
      }
    }

    // Scan for imported assets in src directory
    const srcAssets = await glob('**/*.{png,jpg,jpeg,gif,svg,ico,webp,css,scss,sass,less,woff,woff2,ttf,eot}', {
      cwd: join(this.webAppDir, 'src'),
      nodir: true
    });

    for (const assetPath of srcAssets) {
      const fullPath = join(this.webAppDir, 'src', assetPath);
      const relativePath = `./src/${assetPath}`;

      try {
        const stats = await fs.stat(fullPath);
        this.assetReferences.set(relativePath, {
          path: relativePath,
          referencedBy: [],
          type: this.getAssetType(assetPath),
          size: stats.size
        });
      } catch (error) {
        this.errors.push(`Failed to stat src asset ${relativePath}: ${error}`);
      }
    }
  }

  private async scanSourceFiles(): Promise<void> {
    console.log('🔎 Scanning source files for asset references...');

    const sourceFiles = await glob('**/*.{ts,tsx,js,jsx,css,scss,sass,less,md,mdx}', {
      cwd: this.webAppDir,
      ignore: ['node_modules/**', '.next/**', 'dist/**', 'build/**'],
      nodir: true
    });

    for (const filePath of sourceFiles) {
      await this.scanFileForAssetReferences(join(this.webAppDir, filePath), filePath);
    }
  }

  private async scanFileForAssetReferences(fullPath: string, relativePath: string): Promise<void> {
    try {
      const content = await fs.readFile(fullPath, 'utf-8');

      // Pattern for import statements
      const importPatterns = [
        // ES6 imports: import img from './image.png'
        /import\s+.*?\s+from\s+['"](.*?\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|scss|sass|less|woff|woff2|ttf|eot))['"]$/gm,
        // Dynamic imports: import('./image.png')
        /import\s*\(\s*['"](.*?\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|scss|sass|less|woff|woff2|ttf|eot))['"]/.source,
        // Require: require('./image.png')
        /require\s*\(\s*['"](.*?\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|scss|sass|less|woff|woff2|ttf|eot))['"]/.source
      ];

      // Pattern for static references
      const staticPatterns = [
        // src attributes: src="/image.png" or src="./image.png"
        /(?:src|href)\s*=\s*['"]((?:\/|\.\/|\.\.\/)?[^'"]*?\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|scss|sass|less|woff|woff2|ttf|eot))['"]/.source,
        // CSS url(): url('/image.png') or url('./image.png')
        /url\s*\(\s*['"]((?:\/|\.\/|\.\.\/)?[^'"]*?\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|scss|sass|less|woff|woff2|ttf|eot))['"]/.source,
        // CSS url() without quotes: url(/image.png)
        /url\s*\(\s*([^'")]*?\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|scss|sass|less|woff|woff2|ttf|eot))/.source,
        // Background images in CSS
        /background(?:-image)?\s*:\s*url\s*\(\s*['"]((?:\/|\.\/|\.\.\/)?[^'"]*?\.(?:png|jpg|jpeg|gif|svg|ico|webp))['"]/.source
      ];

      const allPatterns = [...importPatterns, ...staticPatterns];

      for (const pattern of allPatterns) {
        const regex = new RegExp(pattern, 'gm');
        let match;

        while ((match = regex.exec(content)) !== null) {
          const assetPath = match[1];
          if (assetPath) {
            this.recordAssetReference(assetPath, relativePath, fullPath);
          }
        }
      }

      // Special handling for Next.js Image component
      this.scanNextImageComponents(content, relativePath);

    } catch (error) {
      this.errors.push(`Failed to scan file ${relativePath}: ${error}`);
    }
  }

  private scanNextImageComponents(content: string, referencedBy: string): void {
    // Next.js Image component patterns
    const imagePatterns = [
      // <Image src="/image.png" />
      /<Image[^>]+src\s*=\s*['"]((?:\/|\.\/|\.\.\/)?[^'"]*?\.(?:png|jpg|jpeg|gif|svg|ico|webp))['"][^>]*>/g,
      // <img src="/image.png" />
      /<img[^>]+src\s*=\s*['"]((?:\/|\.\/|\.\.\/)?[^'"]*?\.(?:png|jpg|jpeg|gif|svg|ico|webp))['"][^>]*>/g
    ];

    for (const pattern of imagePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const assetPath = match[1];
        if (assetPath) {
          this.recordAssetReference(assetPath, referencedBy);
        }
      }
    }
  }

  private async scanNextJsPatterns(): Promise<void> {
    console.log('🚀 Scanning Next.js specific patterns...');

    // Check metadata files
    const metadataFiles = await glob('**/favicon.ico', { cwd: this.webAppDir, nodir: true });
    for (const file of metadataFiles) {
      this.recordAssetReference(`/${file}`, 'Next.js metadata');
    }

    // Check manifest.json references
    const manifestPath = join(this.publicDir, 'manifest.json');
    if (await this.fileExists(manifestPath)) {
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

        // Scan manifest icons
        if (manifest.icons) {
          for (const icon of manifest.icons) {
            if (icon.src) {
              this.recordAssetReference(icon.src, 'manifest.json');
            }
          }
        }

        // Other manifest assets
        if (manifest.start_url) {
          this.recordAssetReference(manifest.start_url, 'manifest.json');
        }
      } catch (error) {
        this.errors.push(`Failed to parse manifest.json: ${error}`);
      }
    }
  }

  private recordAssetReference(assetPath: string, referencedBy: string, fullReferencePath?: string): void {
    // Normalize asset path
    const normalizedPath = this.normalizeAssetPath(assetPath, fullReferencePath);

    const asset = this.assetReferences.get(normalizedPath);
    if (asset) {
      if (!asset.referencedBy.includes(referencedBy)) {
        asset.referencedBy.push(referencedBy);
      }
    } else {
      // Asset referenced but not found - might be external or missing
      this.assetReferences.set(normalizedPath, {
        path: normalizedPath,
        referencedBy: [referencedBy],
        type: this.getAssetType(normalizedPath)
      });
    }
  }

  private normalizeAssetPath(assetPath: string, referencerPath?: string): string {
    // Handle absolute paths (starting with /)
    if (assetPath.startsWith('/')) {
      return assetPath;
    }

    // Handle relative paths when we have the referencer context
    if (referencerPath && (assetPath.startsWith('./') || assetPath.startsWith('../'))) {
      const referencerDir = dirname(referencerPath);
      const resolved = resolve(referencerDir, assetPath);
      return relative(this.webAppDir, resolved).replace(/\\/g, '/');
    }

    // Default normalization
    return assetPath.startsWith('./') ? assetPath : `./${assetPath}`;
  }

  private getAssetType(path: string): AssetReference['type'] {
    const ext = extname(path).toLowerCase();

    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
      return 'image';
    }
    if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
      return 'css';
    }
    if (['.js', '.ts', '.tsx', '.jsx'].includes(ext)) {
      return 'js';
    }
    if (['.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      return 'font';
    }
    return 'other';
  }

  private generateAnalysis(): AssetAnalysis {
    const assets = Array.from(this.assetReferences.values());
    const usedAssets = assets.filter(asset => asset.referencedBy.length > 0);
    const unusedAssets = assets.filter(asset => asset.referencedBy.length === 0 && asset.size !== undefined);

    // Potentially unused: referenced only once by non-critical files
    const potentiallyUnused = usedAssets.filter(asset =>
      asset.referencedBy.length === 1 &&
      !asset.referencedBy.some(ref => ref.includes('layout') || ref.includes('page'))
    );

    // Large assets (> 100KB)
    const largeAssets = assets.filter(asset =>
      asset.size && asset.size > 100 * 1024
    ).sort((a, b) => (b.size || 0) - (a.size || 0));

    return {
      totalAssets: assets.length,
      usedAssets: usedAssets.length,
      unusedAssets,
      potentiallyUnused,
      largeAssets,
      analysisDate: new Date().toISOString(),
      errors: this.errors
    };
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async saveReport(outputPath: string): Promise<void> {
    const analysis = await this.scanAssets();

    // Create output directory if it doesn't exist
    await fs.mkdir(dirname(outputPath), { recursive: true });

    // Save JSON report
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));

    // Generate markdown summary
    const markdownPath = outputPath.replace('.json', '.md');
    const markdown = this.generateMarkdownReport(analysis);
    await fs.writeFile(markdownPath, markdown);

    console.log(`📊 Asset analysis report saved to ${outputPath}`);
    console.log(`📝 Markdown summary saved to ${markdownPath}`);
  }

  private generateMarkdownReport(analysis: AssetAnalysis): string {
    const { totalAssets, usedAssets, unusedAssets, potentiallyUnused, largeAssets, errors } = analysis;

    return `# Asset Usage Analysis Report

Generated: ${new Date(analysis.analysisDate).toLocaleString()}

## Summary
- **Total Assets**: ${totalAssets}
- **Used Assets**: ${usedAssets}
- **Unused Assets**: ${unusedAssets.length}
- **Potentially Unused**: ${potentiallyUnused.length}
- **Large Assets (>100KB)**: ${largeAssets.length}

## Unused Assets
${unusedAssets.length === 0 ? 'No unused assets found.' : unusedAssets.map(asset =>
  `- \`${asset.path}\` (${asset.size ? `${Math.round(asset.size / 1024)}KB` : 'unknown size'})`
).join('\n')}

## Potentially Unused Assets
${potentiallyUnused.length === 0 ? 'No potentially unused assets found.' : potentiallyUnused.map(asset =>
  `- \`${asset.path}\` - Referenced by: ${asset.referencedBy.join(', ')}`
).join('\n')}

## Large Assets
${largeAssets.length === 0 ? 'No large assets found.' : largeAssets.map(asset =>
  `- \`${asset.path}\` (${Math.round((asset.size || 0) / 1024)}KB) - References: ${asset.referencedBy.length}`
).join('\n')}

${errors.length > 0 ? `## Errors
${errors.map(error => `- ${error}`).join('\n')}` : ''}
`;
  }
}

// CLI usage
if (require.main === module) {
  const scanner = new AssetScanner();
  const outputPath = join(process.cwd(), 'reports/asset-analysis.json');

  scanner.saveReport(outputPath).catch(error => {
    console.error('Asset analysis failed:', error);
    process.exit(1);
  });
}

export { AssetScanner, type AssetAnalysis, type AssetReference };