import { Page } from '@playwright/test';

/**
 * Performance metrics for a page
 */
export interface PerformanceMetrics {
  /** Page load time in milliseconds */
  loadTime: number;
  /** Time to first contentful paint */
  firstContentfulPaint?: number;
  /** Time to largest contentful paint */
  largestContentfulPaint?: number;
  /** First input delay */
  firstInputDelay?: number;
  /** Cumulative layout shift */
  cumulativeLayoutShift?: number;
  /** Memory usage information */
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  /** Network requests summary */
  networkSummary?: {
    totalRequests: number;
    totalSize: number;
    slowRequests: Array<{ url: string; duration: number; size: number }>;
  };
  /** Performance score (0-100) */
  score: number;
}

/**
 * Performance monitoring utility for E2E tests
 */
export class PerformanceMonitor {
  private page: Page;
  private networkRequests: Array<{ url: string; startTime: number; endTime?: number; size?: number }> = [];

  constructor(page: Page) {
    this.page = page;
    this.setupNetworkMonitoring();
  }

  /**
   * Setup network request monitoring
   */
  private setupNetworkMonitoring(): void {
    this.page.on('request', (request) => {
      this.networkRequests.push({
        url: request.url(),
        startTime: Date.now(),
      });
    });

    this.page.on('response', (response) => {
      const request = this.networkRequests.find(r => r.url === response.url() && !r.endTime);
      if (request) {
        request.endTime = Date.now();
        request.size = response.headers()['content-length'] ? parseInt(response.headers()['content-length']) : 0;
      }
    });
  }

  /**
   * Monitor performance for a page load
   */
  async monitorPageLoad(url: string): Promise<PerformanceMetrics> {
    // Clear previous requests
    this.networkRequests = [];

    const startTime = Date.now();

    // Navigate to page
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Get web vitals and performance metrics
    const webVitals = await this.getWebVitals();
    const memoryUsage = await this.getMemoryUsage();
    const networkSummary = this.getNetworkSummary();

    // Calculate performance score
    const score = this.calculatePerformanceScore({
      loadTime,
      ...webVitals,
      memoryUsage,
      networkSummary
    });

    return {
      loadTime,
      ...webVitals,
      memoryUsage,
      networkSummary,
      score
    };
  }

  /**
   * Get Core Web Vitals metrics
   */
  private async getWebVitals(): Promise<Partial<PerformanceMetrics>> {
    try {
      const metrics = await this.page.evaluate(() => {
        return new Promise<any>((resolve) => {
          // Use Performance Observer to collect metrics
          const metrics: any = {};

          // Get navigation timing
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (navigation) {
            metrics.firstContentfulPaint = navigation.domContentLoadedEventEnd - navigation.navigationStart;
          }

          // Try to get paint metrics
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach(entry => {
            if (entry.name === 'first-contentful-paint') {
              metrics.firstContentfulPaint = entry.startTime;
            }
          });

          // Get LCP if available
          if ('PerformanceObserver' in window) {
            try {
              const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lcpEntry = entries[entries.length - 1];
                if (lcpEntry) {
                  metrics.largestContentfulPaint = lcpEntry.startTime;
                }
              });
              observer.observe({ type: 'largest-contentful-paint', buffered: true });

              // Get CLS
              const clsObserver = new PerformanceObserver((list) => {
                let clsValue = 0;
                for (const entry of list.getEntries()) {
                  if (!(entry as any).hadRecentInput) {
                    clsValue += (entry as any).value;
                  }
                }
                metrics.cumulativeLayoutShift = clsValue;
              });
              clsObserver.observe({ type: 'layout-shift', buffered: true });

            } catch (error) {
              console.warn('Could not observe performance metrics:', error);
            }
          }

          // Return metrics after a short delay to allow collection
          setTimeout(() => resolve(metrics), 500);
        });
      });

      return metrics;
    } catch (error) {
      console.warn('Could not collect web vitals:', error);
      return {};
    }
  }

  /**
   * Get memory usage information
   */
  private async getMemoryUsage(): Promise<PerformanceMetrics['memoryUsage']> {
    try {
      const memoryInfo = await this.page.evaluate(() => {
        if ('memory' in performance) {
          return {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          };
        }
        return null;
      });

      return memoryInfo;
    } catch (error) {
      console.warn('Could not collect memory usage:', error);
      return undefined;
    }
  }

  /**
   * Get network requests summary
   */
  private getNetworkSummary(): PerformanceMetrics['networkSummary'] {
    const completedRequests = this.networkRequests.filter(r => r.endTime);
    const totalSize = completedRequests.reduce((sum, r) => sum + (r.size || 0), 0);

    // Find slow requests (>1000ms)
    const slowRequests = completedRequests
      .filter(r => r.endTime && (r.endTime - r.startTime) > 1000)
      .map(r => ({
        url: r.url,
        duration: r.endTime! - r.startTime,
        size: r.size || 0
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 slowest

    return {
      totalRequests: completedRequests.length,
      totalSize,
      slowRequests
    };
  }

  /**
   * Calculate overall performance score (0-100)
   */
  private calculatePerformanceScore(metrics: Partial<PerformanceMetrics>): number {
    let score = 100;

    // Load time impact (0-40 points)
    if (metrics.loadTime) {
      if (metrics.loadTime > 3000) score -= 40;
      else if (metrics.loadTime > 2000) score -= 25;
      else if (metrics.loadTime > 1000) score -= 10;
    }

    // FCP impact (0-20 points)
    if (metrics.firstContentfulPaint) {
      if (metrics.firstContentfulPaint > 3000) score -= 20;
      else if (metrics.firstContentfulPaint > 2000) score -= 10;
      else if (metrics.firstContentfulPaint > 1000) score -= 5;
    }

    // LCP impact (0-20 points)
    if (metrics.largestContentfulPaint) {
      if (metrics.largestContentfulPaint > 4000) score -= 20;
      else if (metrics.largestContentfulPaint > 2500) score -= 10;
    }

    // CLS impact (0-10 points)
    if (metrics.cumulativeLayoutShift) {
      if (metrics.cumulativeLayoutShift > 0.25) score -= 10;
      else if (metrics.cumulativeLayoutShift > 0.1) score -= 5;
    }

    // Network efficiency (0-10 points)
    if (metrics.networkSummary) {
      if (metrics.networkSummary.slowRequests.length > 5) score -= 10;
      else if (metrics.networkSummary.slowRequests.length > 2) score -= 5;

      if (metrics.networkSummary.totalSize > 5000000) score -= 5; // >5MB
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate performance report
   */
  generateReport(metrics: PerformanceMetrics, pageName: string): string {
    const report = [];
    report.push(`=== Performance Report: ${pageName} ===`);
    report.push(`Overall Score: ${metrics.score}/100`);
    report.push(`Load Time: ${metrics.loadTime}ms`);

    if (metrics.firstContentfulPaint) {
      report.push(`First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(0)}ms`);
    }

    if (metrics.largestContentfulPaint) {
      report.push(`Largest Contentful Paint: ${metrics.largestContentfulPaint.toFixed(0)}ms`);
    }

    if (metrics.cumulativeLayoutShift) {
      report.push(`Cumulative Layout Shift: ${metrics.cumulativeLayoutShift.toFixed(3)}`);
    }

    if (metrics.memoryUsage) {
      report.push(`Memory Usage: ${(metrics.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
    }

    if (metrics.networkSummary) {
      report.push(`Network Requests: ${metrics.networkSummary.totalRequests}`);
      report.push(`Total Download Size: ${(metrics.networkSummary.totalSize / 1024).toFixed(1)}KB`);

      if (metrics.networkSummary.slowRequests.length > 0) {
        report.push(`Slow Requests (>1s):`);
        metrics.networkSummary.slowRequests.forEach(req => {
          report.push(`  - ${req.duration}ms: ${this.truncateUrl(req.url)}`);
        });
      }
    }

    // Performance recommendations
    const recommendations = this.generateRecommendations(metrics);
    if (recommendations.length > 0) {
      report.push(`\nRecommendations:`);
      recommendations.forEach(rec => report.push(`  - ${rec}`));
    }

    return report.join('\n');
  }

  /**
   * Generate performance improvement recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.loadTime > 3000) {
      recommendations.push('Optimize page load time - consider code splitting, image optimization, and caching');
    }

    if (metrics.firstContentfulPaint && metrics.firstContentfulPaint > 2000) {
      recommendations.push('Improve First Contentful Paint - inline critical CSS and defer non-critical resources');
    }

    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      recommendations.push('Optimize Largest Contentful Paint - compress images and prioritize above-fold content');
    }

    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > 0.1) {
      recommendations.push('Reduce Cumulative Layout Shift - specify image dimensions and avoid dynamic content insertion');
    }

    if (metrics.memoryUsage && metrics.memoryUsage.usedJSHeapSize > 50 * 1024 * 1024) {
      recommendations.push('High memory usage detected - check for memory leaks and optimize JavaScript');
    }

    if (metrics.networkSummary && metrics.networkSummary.slowRequests.length > 3) {
      recommendations.push('Multiple slow network requests - optimize API calls and consider request bundling');
    }

    return recommendations;
  }

  /**
   * Truncate URL for display
   */
  private truncateUrl(url: string, maxLength: number = 60): string {
    if (url.length <= maxLength) return url;

    const start = url.substring(0, 30);
    const end = url.substring(url.length - 25);
    return `${start}...${end}`;
  }

  /**
   * Compare performance between two metrics
   */
  static comparePerformance(
    baseline: PerformanceMetrics,
    current: PerformanceMetrics
  ): {
    loadTimeDelta: number;
    scoreDelta: number;
    isRegression: boolean;
    summary: string;
  } {
    const loadTimeDelta = current.loadTime - baseline.loadTime;
    const scoreDelta = current.score - baseline.score;
    const isRegression = scoreDelta < -5 || loadTimeDelta > 1000; // >5 point drop or >1s slower

    let summary = '';
    if (isRegression) {
      summary = `Performance regression detected: ${loadTimeDelta > 0 ? '+' : ''}${loadTimeDelta}ms load time, ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(1)} score change`;
    } else if (scoreDelta > 5) {
      summary = `Performance improved: ${loadTimeDelta > 0 ? '+' : ''}${loadTimeDelta}ms load time, +${scoreDelta.toFixed(1)} score improvement`;
    } else {
      summary = `Performance stable: ${loadTimeDelta > 0 ? '+' : ''}${loadTimeDelta}ms load time, ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(1)} score change`;
    }

    return {
      loadTimeDelta,
      scoreDelta,
      isRegression,
      summary
    };
  }

  /**
   * Reset monitoring state
   */
  reset(): void {
    this.networkRequests = [];
  }
}