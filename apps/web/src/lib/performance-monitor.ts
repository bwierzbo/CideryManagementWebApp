/**
 * Frontend Performance Monitoring Utility
 *
 * Tracks page load times, API response times, user interactions, and performance metrics
 * for the cidery management application frontend.
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
  /** Time to interactive */
  timeToInteractive?: number;
  /** Total blocking time */
  totalBlockingTime?: number;
  /** Bundle size metrics */
  bundleMetrics?: {
    totalSize: number;
    chunkCount: number;
    largestChunk: string;
  };
  /** API performance metrics */
  apiMetrics?: {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: Array<{ url: string; duration: number }>;
  };
  /** Memory usage information */
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  /** Performance budget violations */
  budgetViolations?: Array<{
    metric: string;
    value: number;
    budget: number;
    violation: number;
  }>;
}

export interface APIRequest {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  size?: number;
}

export interface UserInteraction {
  type: "click" | "navigation" | "form_submit" | "search" | "export";
  target: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Performance budgets for key metrics
 */
export const PERFORMANCE_BUDGETS = {
  loadTime: 3000, // 3 seconds
  firstContentfulPaint: 1800, // 1.8 seconds
  largestContentfulPaint: 2500, // 2.5 seconds
  cumulativeLayoutShift: 0.1, // CLS threshold
  timeToInteractive: 3800, // 3.8 seconds
  totalBlockingTime: 300, // 300ms
  bundleSize: 2000000, // 2MB
  apiResponseTime: 1000, // 1 second average
} as const;

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private apiRequests: Map<string, APIRequest> = new Map();
  private userInteractions: UserInteraction[] = [];
  private perfObserver?: PerformanceObserver;
  private isEnabled: boolean = true;
  private pageLoadStartTime: number = 0;

  private constructor() {
    if (typeof window !== "undefined") {
      this.initializeMonitoring();
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    // Track page load start
    this.pageLoadStartTime = performance.now();

    // Initialize Performance Observer for Web Vitals
    this.initializeWebVitalsObserver();

    // Monitor API requests
    this.initializeAPIMonitoring();

    // Track user interactions
    this.initializeInteractionTracking();

    // Monitor memory usage periodically
    this.initializeMemoryMonitoring();
  }

  /**
   * Initialize Web Vitals monitoring using Performance Observer
   */
  private initializeWebVitalsObserver(): void {
    if (!("PerformanceObserver" in window)) return;

    try {
      // Monitor LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcpEntry = entries[entries.length - 1];
        if (lcpEntry) {
          this.reportMetric("largest-contentful-paint", lcpEntry.startTime);
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

      // Monitor FID (First Input Delay)
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.reportMetric(
            "first-input-delay",
            (entry as any).processingStart - entry.startTime,
          );
        }
      });
      fidObserver.observe({ type: "first-input", buffered: true });

      // Monitor CLS (Cumulative Layout Shift)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.reportMetric("cumulative-layout-shift", clsValue);
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });

      // Monitor FCP (First Contentful Paint)
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            this.reportMetric("first-contentful-paint", entry.startTime);
          }
        }
      });
      fcpObserver.observe({ type: "paint", buffered: true });
    } catch (error) {
      console.warn("Failed to initialize Web Vitals observer:", error);
    }
  }

  /**
   * Initialize API request monitoring
   */
  private initializeAPIMonitoring(): void {
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const requestId = this.generateRequestId();
      const url =
        typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      const method = args[1]?.method || "GET";

      const apiRequest: APIRequest = {
        url,
        method,
        startTime: performance.now(),
      };

      this.apiRequests.set(requestId, apiRequest);

      try {
        const response = await originalFetch(...args);

        // Update request with completion data
        const completedRequest = this.apiRequests.get(requestId);
        if (completedRequest) {
          completedRequest.endTime = performance.now();
          completedRequest.duration =
            completedRequest.endTime - completedRequest.startTime;
          completedRequest.status = response.status;

          // Get response size if available
          const contentLength = response.headers.get("content-length");
          if (contentLength) {
            completedRequest.size = parseInt(contentLength, 10);
          }

          this.reportAPIRequest(completedRequest);
        }

        return response;
      } catch (error) {
        // Handle request error
        const failedRequest = this.apiRequests.get(requestId);
        if (failedRequest) {
          failedRequest.endTime = performance.now();
          failedRequest.duration =
            failedRequest.endTime - failedRequest.startTime;
          failedRequest.status = 0; // Error status
          this.reportAPIRequest(failedRequest);
        }
        throw error;
      }
    };
  }

  /**
   * Initialize user interaction tracking
   */
  private initializeInteractionTracking(): void {
    // Track clicks on important elements
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const interactionTarget = this.getInteractionTarget(target);

      if (interactionTarget) {
        this.recordUserInteraction({
          type: "click",
          target: interactionTarget,
          timestamp: performance.now(),
        });
      }
    });

    // Track form submissions
    document.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      this.recordUserInteraction({
        type: "form_submit",
        target: form.name || form.id || "unknown-form",
        timestamp: performance.now(),
      });
    });

    // Track navigation (page changes)
    this.trackNavigation();
  }

  /**
   * Initialize memory monitoring
   */
  private initializeMemoryMonitoring(): void {
    // Monitor memory usage every 30 seconds
    setInterval(() => {
      if ("memory" in performance) {
        const memoryInfo = (performance as any).memory;
        this.reportMetric("memory-usage", memoryInfo.usedJSHeapSize);
      }
    }, 30000);
  }

  /**
   * Track navigation events
   */
  private trackNavigation(): void {
    // Track initial page load
    window.addEventListener("load", () => {
      const loadTime = performance.now() - this.pageLoadStartTime;
      this.reportMetric("page-load-time", loadTime);
    });

    // Track SPA navigation (if using client-side routing)
    let previousUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== previousUrl) {
        this.recordUserInteraction({
          type: "navigation",
          target: window.location.pathname,
          timestamp: performance.now(),
        });
        previousUrl = window.location.href;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Get interaction target identifier
   */
  private getInteractionTarget(element: HTMLElement): string | null {
    // Check for data attributes or IDs that identify important UI elements
    if (element.dataset.trackingId) return element.dataset.trackingId;
    if (element.id) return element.id;

    // Check for specific classes that indicate important interactions
    const importantClasses = ["btn", "button", "link", "nav-item", "menu-item"];
    for (const className of importantClasses) {
      if (element.classList.contains(className)) {
        return element.textContent?.trim().substring(0, 50) || className;
      }
    }

    // Check parent elements
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      if (parent.dataset.trackingId) return parent.dataset.trackingId;
      if (parent.id) return parent.id;
      parent = parent.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record user interaction
   */
  recordUserInteraction(interaction: UserInteraction): void {
    if (!this.isEnabled) return;

    this.userInteractions.push(interaction);

    // Keep only last 100 interactions to prevent memory bloat
    if (this.userInteractions.length > 100) {
      this.userInteractions = this.userInteractions.slice(-100);
    }
  }

  /**
   * Report performance metric
   */
  private reportMetric(name: string, value: number): void {
    if (!this.isEnabled) return;

    // Check against performance budgets
    const budget = this.getBudgetForMetric(name);
    if (budget && value > budget) {
      console.warn(
        `Performance budget violation: ${name} = ${value.toFixed(2)}ms (budget: ${budget}ms)`,
      );
    }

    // Log significant metrics in development
    if (process.env.NODE_ENV === "development") {
      console.log(`Performance metric: ${name} = ${value.toFixed(2)}ms`);
    }
  }

  /**
   * Report API request completion
   */
  private reportAPIRequest(request: APIRequest): void {
    if (!this.isEnabled || !request.duration) return;

    // Check API response time budget
    if (request.duration > PERFORMANCE_BUDGETS.apiResponseTime) {
      console.warn(
        `Slow API request: ${request.method} ${request.url} took ${request.duration.toFixed(2)}ms`,
      );
    }

    // Log slow requests in development
    if (process.env.NODE_ENV === "development" && request.duration > 500) {
      console.log(
        `API request: ${request.method} ${request.url} - ${request.duration.toFixed(2)}ms`,
      );
    }
  }

  /**
   * Get performance budget for metric
   */
  private getBudgetForMetric(name: string): number | null {
    const budgetMap: Record<string, keyof typeof PERFORMANCE_BUDGETS> = {
      "page-load-time": "loadTime",
      "first-contentful-paint": "firstContentfulPaint",
      "largest-contentful-paint": "largestContentfulPaint",
      "cumulative-layout-shift": "cumulativeLayoutShift",
      "time-to-interactive": "timeToInteractive",
      "total-blocking-time": "totalBlockingTime",
    };

    const budgetKey = budgetMap[name];
    return budgetKey ? PERFORMANCE_BUDGETS[budgetKey] : null;
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      loadTime: 0,
      budgetViolations: [],
    };

    try {
      // Get basic timing information
      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        metrics.loadTime = navigation.loadEventEnd - navigation.startTime;
        metrics.timeToInteractive =
          navigation.domInteractive - navigation.startTime;
      }

      // Get paint metrics
      const paintEntries = performance.getEntriesByType("paint");
      for (const entry of paintEntries) {
        if (entry.name === "first-contentful-paint") {
          metrics.firstContentfulPaint = entry.startTime;
        }
      }

      // Get memory usage
      if ("memory" in performance) {
        const memoryInfo = (performance as any).memory;
        metrics.memoryUsage = {
          usedJSHeapSize: memoryInfo.usedJSHeapSize,
          totalJSHeapSize: memoryInfo.totalJSHeapSize,
          jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
        };
      }

      // Get API metrics
      const completedRequests = Array.from(this.apiRequests.values()).filter(
        (r) => r.duration,
      );
      if (completedRequests.length > 0) {
        const totalDuration = completedRequests.reduce(
          (sum, r) => sum + (r.duration || 0),
          0,
        );
        const slowRequests = completedRequests
          .filter(
            (r) => (r.duration || 0) > PERFORMANCE_BUDGETS.apiResponseTime,
          )
          .map((r) => ({ url: r.url, duration: r.duration || 0 }))
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10);

        metrics.apiMetrics = {
          totalRequests: completedRequests.length,
          averageResponseTime: totalDuration / completedRequests.length,
          slowRequests,
        };
      }

      // Check for budget violations
      metrics.budgetViolations = this.getBudgetViolations(metrics);
    } catch (error) {
      console.warn("Failed to collect performance metrics:", error);
    }

    return metrics;
  }

  /**
   * Get budget violations
   */
  private getBudgetViolations(metrics: PerformanceMetrics): Array<{
    metric: string;
    value: number;
    budget: number;
    violation: number;
  }> {
    const violations = [];

    const checks = [
      {
        metric: "loadTime",
        value: metrics.loadTime,
        budget: PERFORMANCE_BUDGETS.loadTime,
      },
      {
        metric: "firstContentfulPaint",
        value: metrics.firstContentfulPaint,
        budget: PERFORMANCE_BUDGETS.firstContentfulPaint,
      },
      {
        metric: "largestContentfulPaint",
        value: metrics.largestContentfulPaint,
        budget: PERFORMANCE_BUDGETS.largestContentfulPaint,
      },
      {
        metric: "cumulativeLayoutShift",
        value: metrics.cumulativeLayoutShift,
        budget: PERFORMANCE_BUDGETS.cumulativeLayoutShift,
      },
    ];

    for (const check of checks) {
      if (check.value !== undefined && check.value > check.budget) {
        violations.push({
          metric: check.metric,
          value: check.value,
          budget: check.budget,
          violation: check.value - check.budget,
        });
      }
    }

    return violations;
  }

  /**
   * Generate performance report
   */
  async generateReport(): Promise<string> {
    const metrics = await this.getPerformanceMetrics();
    const report = [];

    report.push("=== Frontend Performance Report ===");
    report.push(`Load Time: ${metrics.loadTime.toFixed(2)}ms`);

    if (metrics.firstContentfulPaint) {
      report.push(
        `First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(2)}ms`,
      );
    }

    if (metrics.largestContentfulPaint) {
      report.push(
        `Largest Contentful Paint: ${metrics.largestContentfulPaint.toFixed(2)}ms`,
      );
    }

    if (metrics.memoryUsage) {
      report.push(
        `Memory Usage: ${(metrics.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    if (metrics.apiMetrics) {
      report.push(`API Requests: ${metrics.apiMetrics.totalRequests}`);
      report.push(
        `Average API Response Time: ${metrics.apiMetrics.averageResponseTime.toFixed(2)}ms`,
      );

      if (metrics.apiMetrics.slowRequests.length > 0) {
        report.push(
          `Slow API Requests (>${PERFORMANCE_BUDGETS.apiResponseTime}ms):`,
        );
        metrics.apiMetrics.slowRequests.forEach((req) => {
          report.push(`  - ${req.duration.toFixed(2)}ms: ${req.url}`);
        });
      }
    }

    if (metrics.budgetViolations && metrics.budgetViolations.length > 0) {
      report.push("\nPerformance Budget Violations:");
      metrics.budgetViolations.forEach((violation) => {
        report.push(
          `  - ${violation.metric}: ${violation.value.toFixed(2)} (budget: ${violation.budget}, violation: +${violation.violation.toFixed(2)})`,
        );
      });
    }

    report.push(`\nUser Interactions Tracked: ${this.userInteractions.length}`);

    return report.join("\n");
  }

  /**
   * Clear monitoring data
   */
  clearData(): void {
    this.apiRequests.clear();
    this.userInteractions = [];
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Get user interactions
   */
  getUserInteractions(): UserInteraction[] {
    return [...this.userInteractions];
  }

  /**
   * Mark interaction completion with duration
   */
  completeUserInteraction(target: string, duration: number): void {
    const interaction = this.userInteractions
      .slice()
      .reverse()
      .find((i) => i.target === target && !i.duration);

    if (interaction) {
      interaction.duration = duration;
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Export utility functions
export const trackPageLoad = () => performanceMonitor.getPerformanceMetrics();
export const trackUserInteraction = (interaction: UserInteraction) =>
  performanceMonitor.recordUserInteraction(interaction);
export const generatePerformanceReport = () =>
  performanceMonitor.generateReport();
