#!/usr/bin/env tsx

/**
 * Bundle Analysis Script for CI Pipeline
 *
 * Analyzes bundle size, generates reports, and tracks trends
 * Used by GitHub Actions for performance monitoring
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface BundleAnalysis {
  timestamp: string;
  commit?: string;
  totalSizeKB: number;
  gzippedSizeKB: number;
  files: Array<{
    name: string;
    sizeKB: number;
    gzippedKB: number;
    type: 'main' | 'chunk' | 'vendor' | 'css';
  }>;
  chunks: Array<{
    name: string;
    sizeKB: number;
    files: string[];
  }>;
  warnings: string[];
  recommendations: string[];
}

interface BundleTrend {
  date: string;
  commit: string;
  totalSize: number;
  gzippedSize: number;
  changePercent: number;
}

class BundleAnalyzer {
  private outputDir: string;
  private reportsDir: string;
  private trendsDir: string;

  constructor() {
    this.outputDir = path.resolve(process.cwd(), 'apps/web/.next');
    this.reportsDir = path.resolve(process.cwd(), 'analysis/reports/ci');
    this.trendsDir = path.resolve(process.cwd(), 'analysis/reports/trends');
  }

  async analyze(): Promise<BundleAnalysis> {
    console.log('🔍 Starting bundle analysis...');

    // Ensure output directories exist
    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.mkdir(this.trendsDir, { recursive: true });

    const analysis: BundleAnalysis = {
      timestamp: new Date().toISOString(),
      commit: this.getCommitHash(),
      totalSizeKB: 0,
      gzippedSizeKB: 0,
      files: [],
      chunks: [],
      warnings: [],
      recommendations: []
    };

    // Check if build exists
    if (!await this.buildExists()) {
      throw new Error('No build output found. Run `pnpm build` first.');
    }

    // Analyze static files
    await this.analyzeStaticFiles(analysis);

    // Analyze chunks
    await this.analyzeChunks(analysis);

    // Generate warnings and recommendations
    this.generateInsights(analysis);

    // Save analysis
    await this.saveAnalysis(analysis);

    // Update trends
    await this.updateTrends(analysis);

    console.log(`📊 Bundle analysis complete: ${analysis.totalSizeKB}KB total`);
    return analysis;
  }

  private async buildExists(): Promise<boolean> {
    try {
      const stat = await fs.stat(this.outputDir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private getCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private async analyzeStaticFiles(analysis: BundleAnalysis): Promise<void> {
    const staticDir = path.join(this.outputDir, 'static');

    try {
      await this.processDirectory(staticDir, analysis, '');
    } catch (error) {
      console.warn('Warning: Could not analyze static directory:', error);
    }
  }

  private async processDirectory(dir: string, analysis: BundleAnalysis, relativePath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          await this.processDirectory(fullPath, analysis, relPath);
        } else if (entry.isFile() && this.shouldAnalyzeFile(entry.name)) {
          await this.analyzeFile(fullPath, relPath, analysis);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not process directory ${dir}:`, error);
    }
  }

  private shouldAnalyzeFile(filename: string): boolean {
    return /\.(js|css|woff2?|png|jpg|jpeg|svg|ico)$/.test(filename);
  }

  private async analyzeFile(fullPath: string, relativePath: string, analysis: BundleAnalysis): Promise<void> {
    try {
      const stats = await fs.stat(fullPath);
      const sizeKB = Math.round(stats.size / 1024 * 100) / 100;

      // Estimate gzipped size (rough approximation)
      const gzippedKB = Math.round(sizeKB * 0.3 * 100) / 100;

      const fileType = this.getFileType(relativePath);

      analysis.files.push({
        name: relativePath,
        sizeKB,
        gzippedKB,
        type: fileType
      });

      analysis.totalSizeKB += sizeKB;
      analysis.gzippedSizeKB += gzippedKB;
    } catch (error) {
      console.warn(`Warning: Could not analyze file ${relativePath}:`, error);
    }
  }

  private getFileType(filename: string): 'main' | 'chunk' | 'vendor' | 'css' {
    if (filename.includes('css')) return 'css';
    if (filename.includes('vendor') || filename.includes('node_modules')) return 'vendor';
    if (filename.includes('chunk') || filename.includes('_app')) return 'chunk';
    return 'main';
  }

  private async analyzeChunks(analysis: BundleAnalysis): Promise<void> {
    // Analyze Next.js build manifest
    const buildManifestPath = path.join(this.outputDir, '_buildManifest.js');

    try {
      const manifestContent = await fs.readFile(buildManifestPath, 'utf8');
      const chunks = this.extractChunksFromManifest(manifestContent);
      analysis.chunks = chunks;
    } catch (error) {
      console.warn('Warning: Could not analyze build manifest:', error);
    }
  }

  private extractChunksFromManifest(content: string): Array<{ name: string; sizeKB: number; files: string[] }> {
    // This is a simplified extraction - in practice you'd parse the manifest more thoroughly
    const chunks: Array<{ name: string; sizeKB: number; files: string[] }> = [];

    // Extract chunk information from the manifest
    // This would need to be implemented based on the actual manifest structure

    return chunks;
  }

  private generateInsights(analysis: BundleAnalysis): void {
    // Size warnings
    if (analysis.totalSizeKB > 1000) {
      analysis.warnings.push(`Bundle size (${analysis.totalSizeKB}KB) exceeds 1MB threshold`);
    }

    // Large file warnings
    const largeFiles = analysis.files.filter(f => f.sizeKB > 100);
    if (largeFiles.length > 0) {
      analysis.warnings.push(`${largeFiles.length} files exceed 100KB`);
    }

    // Recommendations
    const jsFiles = analysis.files.filter(f => f.name.endsWith('.js'));
    const totalJSSize = jsFiles.reduce((sum, f) => sum + f.sizeKB, 0);

    if (totalJSSize > 500) {
      analysis.recommendations.push('Consider code splitting to reduce initial bundle size');
    }

    const cssFiles = analysis.files.filter(f => f.name.endsWith('.css'));
    const totalCSSSize = cssFiles.reduce((sum, f) => sum + f.sizeKB, 0);

    if (totalCSSSize > 50) {
      analysis.recommendations.push('Consider CSS optimization and critical CSS extraction');
    }

    // Check for duplicate libraries
    const vendorFiles = analysis.files.filter(f => f.type === 'vendor');
    if (vendorFiles.length > 5) {
      analysis.recommendations.push('Review vendor chunks for potential optimization');
    }
  }

  private async saveAnalysis(analysis: BundleAnalysis): Promise<void> {
    // Save JSON report
    const jsonPath = path.join(this.reportsDir, 'bundle-analysis.json');
    await fs.writeFile(jsonPath, JSON.stringify(analysis, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(analysis);
    const mdPath = path.join(this.reportsDir, 'bundle-size.md');
    await fs.writeFile(mdPath, markdownReport);

    console.log(`📄 Reports saved to ${this.reportsDir}`);
  }

  private generateMarkdownReport(analysis: BundleAnalysis): string {
    const { totalSizeKB, gzippedSizeKB, files, warnings, recommendations } = analysis;

    let report = `# Bundle Size Analysis\n\n`;
    report += `**Generated:** ${new Date(analysis.timestamp).toUTCString()}\n`;
    report += `**Commit:** ${analysis.commit}\n\n`;

    // Summary
    report += `## Summary\n\n`;
    report += `- **Total Size:** ${totalSizeKB.toFixed(2)}KB\n`;
    report += `- **Gzipped Size:** ${gzippedSizeKB.toFixed(2)}KB\n`;
    report += `- **Files Analyzed:** ${files.length}\n\n`;

    // Largest files
    const sortedFiles = [...files].sort((a, b) => b.sizeKB - a.sizeKB).slice(0, 10);
    report += `## Largest Files\n\n`;
    report += `| File | Size | Gzipped | Type |\n`;
    report += `|------|------|---------|------|\n`;

    for (const file of sortedFiles) {
      report += `| ${file.name} | ${file.sizeKB.toFixed(2)}KB | ${file.gzippedKB.toFixed(2)}KB | ${file.type} |\n`;
    }
    report += `\n`;

    // Size by type
    const typeStats = this.getTypeStatistics(files);
    report += `## Size by Type\n\n`;
    report += `| Type | Size | Percentage |\n`;
    report += `|------|------|------------|\n`;

    for (const [type, size] of Object.entries(typeStats)) {
      const percentage = ((size / totalSizeKB) * 100).toFixed(1);
      report += `| ${type} | ${size.toFixed(2)}KB | ${percentage}% |\n`;
    }
    report += `\n`;

    // Warnings
    if (warnings.length > 0) {
      report += `## ⚠️ Warnings\n\n`;
      for (const warning of warnings) {
        report += `- ${warning}\n`;
      }
      report += `\n`;
    }

    // Recommendations
    if (recommendations.length > 0) {
      report += `## 💡 Recommendations\n\n`;
      for (const rec of recommendations) {
        report += `- ${rec}\n`;
      }
      report += `\n`;
    }

    return report;
  }

  private getTypeStatistics(files: BundleAnalysis['files']): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const file of files) {
      stats[file.type] = (stats[file.type] || 0) + file.sizeKB;
    }

    return stats;
  }

  private async updateTrends(analysis: BundleAnalysis): Promise<void> {
    const trendFile = path.join(this.trendsDir, 'bundle-trends.json');

    let trends: BundleTrend[] = [];

    try {
      const existing = await fs.readFile(trendFile, 'utf8');
      trends = JSON.parse(existing);
    } catch {
      // File doesn't exist yet, start fresh
    }

    // Calculate change percentage
    let changePercent = 0;
    if (trends.length > 0) {
      const lastSize = trends[trends.length - 1].totalSize;
      changePercent = ((analysis.totalSizeKB - lastSize) / lastSize) * 100;
    }

    // Add new trend entry
    trends.push({
      date: analysis.timestamp,
      commit: analysis.commit || 'unknown',
      totalSize: analysis.totalSizeKB,
      gzippedSize: analysis.gzippedSizeKB,
      changePercent
    });

    // Keep only last 50 entries
    if (trends.length > 50) {
      trends = trends.slice(-50);
    }

    await fs.writeFile(trendFile, JSON.stringify(trends, null, 2));
    console.log(`📈 Trend data updated (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% change)`);
  }
}

// CLI execution
async function main() {
  try {
    const analyzer = new BundleAnalyzer();
    const analysis = await analyzer.analyze();

    // Output summary for CI
    console.log(`::notice::Bundle Size: ${analysis.totalSizeKB}KB (${analysis.gzippedSizeKB}KB gzipped)`);

    if (analysis.warnings.length > 0) {
      for (const warning of analysis.warnings) {
        console.log(`::warning::${warning}`);
      }
    }

    // Set GitHub Actions outputs
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::set-output name=total-size-kb::${analysis.totalSizeKB}`);
      console.log(`::set-output name=gzipped-size-kb::${analysis.gzippedSizeKB}`);
      console.log(`::set-output name=file-count::${analysis.files.length}`);
      console.log(`::set-output name=warnings-count::${analysis.warnings.length}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default BundleAnalyzer;