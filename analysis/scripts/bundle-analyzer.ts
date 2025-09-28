#!/usr/bin/env tsx

/**
 * Enhanced Bundle Analyzer for CI/CD Pipeline
 *
 * Provides detailed bundle size analysis including:
 * - Size breakdown by package and component
 * - Trend analysis over time
 * - Performance impact assessment
 * - Optimization recommendations
 */

import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { glob } from 'glob';

interface BundleFile {
  path: string;
  name: string;
  size: number;
  sizeKB: number;
  type: 'js' | 'css' | 'wasm' | 'other';
  package?: string;
  isChunk: boolean;
  isMain: boolean;
}

interface BundleAnalysis {
  timestamp: string;
  totalSize: number;
  totalSizeKB: number;
  files: BundleFile[];
  packages: Record<string, {
    totalSize: number;
    fileCount: number;
    files: string[];
  }>;
  chunks: {
    main: BundleFile[];
    vendor: BundleFile[];
    dynamic: BundleFile[];
  };
  recommendations: string[];
  trends?: {
    sizeDelta: number;
    fileDelta: number;
    previousAnalysis?: string;
  };
}

interface TrendData {
  timestamp: string;
  commit?: string;
  totalSizeKB: number;
  fileCount: number;
  mainChunkSizeKB: number;
  vendorChunkSizeKB: number;
}

class BundleAnalyzer {
  private buildDir: string;
  private outputDir: string;

  constructor(buildDir = 'apps/web/.next', outputDir = 'analysis/reports/ci') {
    this.buildDir = buildDir;
    this.outputDir = outputDir;
  }

  async analyze(): Promise<BundleAnalysis> {
    console.log('🔍 Starting bundle analysis...');

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    const files = await this.findBundleFiles();
    const analysis: BundleAnalysis = {
      timestamp: new Date().toISOString(),
      totalSize: 0,
      totalSizeKB: 0,
      files,
      packages: {},
      chunks: {
        main: [],
        vendor: [],
        dynamic: []
      },
      recommendations: []
    };

    // Calculate totals and categorize files
    for (const file of files) {
      analysis.totalSize += file.size;

      // Categorize chunks
      if (file.isMain) {
        analysis.chunks.main.push(file);
      } else if (this.isVendorChunk(file.name)) {
        analysis.chunks.vendor.push(file);
      } else {
        analysis.chunks.dynamic.push(file);
      }

      // Track by package if identifiable
      const packageName = this.extractPackageName(file.name);
      if (packageName) {
        file.package = packageName;
        if (!analysis.packages[packageName]) {
          analysis.packages[packageName] = {
            totalSize: 0,
            fileCount: 0,
            files: []
          };
        }
        analysis.packages[packageName].totalSize += file.size;
        analysis.packages[packageName].fileCount++;
        analysis.packages[packageName].files.push(file.name);
      }
    }

    analysis.totalSizeKB = Math.round(analysis.totalSize / 1024);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    // Add trend analysis if previous data exists
    await this.addTrendAnalysis(analysis);

    console.log(`📊 Analysis complete. Total bundle size: ${analysis.totalSizeKB}KB`);
    return analysis;
  }

  private async findBundleFiles(): Promise<BundleFile[]> {
    const staticDir = join(this.buildDir, 'static');
    const files: BundleFile[] = [];

    try {
      // Find all static files (JS, CSS, etc.)
      const patterns = [
        join(staticDir, '**/*.js'),
        join(staticDir, '**/*.css'),
        join(staticDir, '**/*.wasm'),
      ];

      for (const pattern of patterns) {
        const matches = await glob(pattern);

        for (const filePath of matches) {
          const stats = await fs.stat(filePath);
          const fileName = basename(filePath);
          const ext = extname(fileName).slice(1) as BundleFile['type'];

          files.push({
            path: filePath,
            name: fileName,
            size: stats.size,
            sizeKB: Math.round(stats.size / 1024),
            type: ['js', 'css', 'wasm'].includes(ext) ? ext : 'other',
            isChunk: this.isChunkFile(fileName),
            isMain: this.isMainChunk(fileName)
          });
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not find build files:', error);
    }

    return files.sort((a, b) => b.size - a.size);
  }

  private isChunkFile(fileName: string): boolean {
    return /\.[a-f0-9]{8,}\.(js|css)$/.test(fileName) ||
           fileName.includes('chunk') ||
           fileName.includes('pages/');
  }

  private isMainChunk(fileName: string): boolean {
    return fileName.includes('main') ||
           fileName.includes('app') ||
           fileName.includes('index');
  }

  private isVendorChunk(fileName: string): boolean {
    return fileName.includes('vendor') ||
           fileName.includes('framework') ||
           fileName.includes('webpack') ||
           fileName.includes('runtime');
  }

  private extractPackageName(fileName: string): string | undefined {
    // Try to extract package name from chunk filename
    const patterns = [
      /vendor\.([^.]+)\./,
      /([^.]+)\.chunk\./,
      /pages\/([^\/]+)\//,
      /components\/([^\/]+)\//
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  private generateRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = [];
    const { totalSizeKB, chunks, packages } = analysis;

    // Size-based recommendations
    if (totalSizeKB > 1000) {
      recommendations.push('🚨 Bundle size exceeds 1MB. Consider code splitting and lazy loading.');
    } else if (totalSizeKB > 500) {
      recommendations.push('⚠️  Bundle size is large (>500KB). Monitor for further growth.');
    }

    // Main chunk recommendations
    const mainChunkSize = chunks.main.reduce((sum, file) => sum + file.sizeKB, 0);
    if (mainChunkSize > 250) {
      recommendations.push('📦 Main chunk is large (>250KB). Consider extracting vendor dependencies.');
    }

    // Package-specific recommendations
    const sortedPackages = Object.entries(packages)
      .sort(([,a], [,b]) => b.totalSize - a.totalSize)
      .slice(0, 5);

    for (const [packageName, packageData] of sortedPackages) {
      const sizeKB = Math.round(packageData.totalSize / 1024);
      if (sizeKB > 100) {
        recommendations.push(`📚 Package "${packageName}" is large (${sizeKB}KB). Review if all exports are needed.`);
      }
    }

    // Dynamic import recommendations
    if (chunks.dynamic.length < 3 && totalSizeKB > 300) {
      recommendations.push('🔀 Consider implementing more route-based code splitting.');
    }

    // Performance recommendations
    const jsFiles = analysis.files.filter(f => f.type === 'js');
    const cssFiles = analysis.files.filter(f => f.type === 'css');

    if (jsFiles.length > 20) {
      recommendations.push('🗂️  Many JS chunks detected. Consider bundling optimization.');
    }

    if (cssFiles.length > 10) {
      recommendations.push('🎨 Many CSS files detected. Consider CSS bundling optimization.');
    }

    return recommendations;
  }

  private async addTrendAnalysis(analysis: BundleAnalysis): Promise<void> {
    const trendsDir = 'analysis/reports/trends';

    try {
      await fs.mkdir(trendsDir, { recursive: true });

      // Find the most recent trend file
      const trendFiles = await glob(join(trendsDir, '*.json'));
      if (trendFiles.length === 0) {
        console.log('📈 No previous trend data found. This will be the baseline.');
        return;
      }

      const latestTrendFile = trendFiles
        .map(f => ({ path: f, name: basename(f) }))
        .sort((a, b) => b.name.localeCompare(a.name))[0];

      const previousData: TrendData = JSON.parse(
        await fs.readFile(latestTrendFile.path, 'utf-8')
      );

      analysis.trends = {
        sizeDelta: analysis.totalSizeKB - previousData.totalSizeKB,
        fileDelta: analysis.files.length - previousData.fileCount,
        previousAnalysis: previousData.timestamp
      };

      console.log(`📊 Trend analysis: Size ${analysis.trends.sizeDelta >= 0 ? '+' : ''}${analysis.trends.sizeDelta}KB, Files ${analysis.trends.fileDelta >= 0 ? '+' : ''}${analysis.trends.fileDelta}`);

    } catch (error) {
      console.warn('⚠️  Could not load trend data:', error);
    }
  }

  async generateReport(analysis: BundleAnalysis): Promise<void> {
    // Generate JSON report
    const jsonPath = join(this.outputDir, 'bundle-analysis.json');
    await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2));

    // Generate Markdown report
    const mdPath = join(this.outputDir, 'bundle-analysis.md');
    const markdown = this.generateMarkdownReport(analysis);
    await fs.writeFile(mdPath, markdown);

    // Generate trend data
    await this.saveTrendData(analysis);

    console.log(`📄 Reports generated:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Markdown: ${mdPath}`);
  }

  private generateMarkdownReport(analysis: BundleAnalysis): string {
    const { totalSizeKB, files, chunks, packages, recommendations, trends } = analysis;

    let markdown = `# Bundle Analysis Report

**Generated:** ${new Date(analysis.timestamp).toLocaleString()}
**Total Bundle Size:** ${totalSizeKB}KB
**File Count:** ${files.length}

`;

    // Trend information
    if (trends) {
      const sizeEmoji = trends.sizeDelta > 0 ? '📈' : trends.sizeDelta < 0 ? '📉' : '➡️';
      const fileEmoji = trends.fileDelta > 0 ? '📈' : trends.fileDelta < 0 ? '📉' : '➡️';

      markdown += `## 📊 Trends (vs. previous analysis)

| Metric | Change | Emoji |
|--------|--------|-------|
| Bundle Size | ${trends.sizeDelta >= 0 ? '+' : ''}${trends.sizeDelta}KB | ${sizeEmoji} |
| File Count | ${trends.fileDelta >= 0 ? '+' : ''}${trends.fileDelta} | ${fileEmoji} |

`;
    }

    // Chunk breakdown
    markdown += `## 📦 Chunk Breakdown

| Chunk Type | Count | Total Size |
|------------|-------|------------|
| Main | ${chunks.main.length} | ${chunks.main.reduce((sum, f) => sum + f.sizeKB, 0)}KB |
| Vendor | ${chunks.vendor.length} | ${chunks.vendor.reduce((sum, f) => sum + f.sizeKB, 0)}KB |
| Dynamic | ${chunks.dynamic.length} | ${chunks.dynamic.reduce((sum, f) => sum + f.sizeKB, 0)}KB |

`;

    // Largest files
    markdown += `## 🏆 Largest Files (Top 10)

| File | Size | Type |
|------|------|------|
`;

    files.slice(0, 10).forEach(file => {
      markdown += `| ${file.name} | ${file.sizeKB}KB | ${file.type.toUpperCase()} |\n`;
    });

    // Package breakdown
    if (Object.keys(packages).length > 0) {
      markdown += `\n## 📚 Package Breakdown

| Package | Files | Total Size |
|---------|-------|------------|
`;

      Object.entries(packages)
        .sort(([,a], [,b]) => b.totalSize - a.totalSize)
        .slice(0, 10)
        .forEach(([name, data]) => {
          const sizeKB = Math.round(data.totalSize / 1024);
          markdown += `| ${name} | ${data.fileCount} | ${sizeKB}KB |\n`;
        });
    }

    // Recommendations
    if (recommendations.length > 0) {
      markdown += `\n## 💡 Recommendations

`;
      recommendations.forEach(rec => {
        markdown += `- ${rec}\n`;
      });
    }

    markdown += `\n---
*Generated by Bundle Analyzer at ${analysis.timestamp}*
`;

    return markdown;
  }

  private async saveTrendData(analysis: BundleAnalysis): Promise<void> {
    const trendsDir = 'analysis/reports/trends';
    await fs.mkdir(trendsDir, { recursive: true });

    const trendData: TrendData = {
      timestamp: analysis.timestamp,
      commit: process.env.GITHUB_SHA,
      totalSizeKB: analysis.totalSizeKB,
      fileCount: analysis.files.length,
      mainChunkSizeKB: analysis.chunks.main.reduce((sum, f) => sum + f.sizeKB, 0),
      vendorChunkSizeKB: analysis.chunks.vendor.reduce((sum, f) => sum + f.sizeKB, 0)
    };

    const filename = `bundle-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`;
    const trendPath = join(trendsDir, filename);

    await fs.writeFile(trendPath, JSON.stringify(trendData, null, 2));
    console.log(`📈 Trend data saved: ${trendPath}`);
  }
}

// CLI interface
async function main() {
  const analyzer = new BundleAnalyzer();

  try {
    const analysis = await analyzer.analyze();
    await analyzer.generateReport(analysis);

    console.log('\n✅ Bundle analysis complete!');
    console.log(`📊 Total size: ${analysis.totalSizeKB}KB`);
    console.log(`📁 Files analyzed: ${analysis.files.length}`);

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 ${analysis.recommendations.length} recommendations generated`);
    }

    // Exit with error code if bundle is too large
    const maxSizeKB = parseInt(process.env.MAX_BUNDLE_SIZE_KB || '1000');
    if (analysis.totalSizeKB > maxSizeKB) {
      console.error(`❌ Bundle size ${analysis.totalSizeKB}KB exceeds limit of ${maxSizeKB}KB`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Bundle analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { BundleAnalyzer, type BundleAnalysis, type TrendData };