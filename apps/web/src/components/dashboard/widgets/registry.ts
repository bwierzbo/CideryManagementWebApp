import { WidgetConfig, WidgetCategory } from "./types";

/**
 * Central registry of all available dashboard widgets.
 * Widgets are registered here and can be looked up by ID.
 */
class WidgetRegistry {
  private widgets: Map<string, WidgetConfig> = new Map();

  /**
   * Register a widget in the registry
   */
  register(config: WidgetConfig): void {
    if (this.widgets.has(config.id)) {
      console.warn(`Widget "${config.id}" is already registered. Overwriting.`);
    }
    this.widgets.set(config.id, config);
  }

  /**
   * Get a widget by ID
   */
  get(id: string): WidgetConfig | undefined {
    return this.widgets.get(id);
  }

  /**
   * Get all registered widgets
   */
  getAll(): WidgetConfig[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Get widgets by category
   */
  getByCategory(category: WidgetCategory): WidgetConfig[] {
    return this.getAll().filter((w) => w.category === category);
  }

  /**
   * Get all widget IDs
   */
  getIds(): string[] {
    return Array.from(this.widgets.keys());
  }

  /**
   * Check if a widget is registered
   */
  has(id: string): boolean {
    return this.widgets.has(id);
  }

  /**
   * Get widget count
   */
  get count(): number {
    return this.widgets.size;
  }
}

// Singleton instance
export const widgetRegistry = new WidgetRegistry();

/**
 * Helper function to register a widget
 */
export function registerWidget(config: WidgetConfig): void {
  widgetRegistry.register(config);
}

/**
 * Widget IDs as constants for type-safe references
 */
export const WIDGET_IDS = {
  PRODUCTION_STATUS: "production-status",
  TODAYS_TASKS: "todays-tasks",
  CRITICAL_ALERTS: "critical-alerts",
  QUICK_ACTIONS: "quick-actions",
  RAW_MATERIALS: "raw-materials",
  FINISHED_GOODS: "finished-goods",
  VESSEL_MAP: "vessel-map",
  FERMENTATION_HEALTH: "fermentation-health",
  ACTIVE_CARBONATIONS: "active-carbonations",
  COGS_SUMMARY: "cogs-summary",
} as const;

export type WidgetId = (typeof WIDGET_IDS)[keyof typeof WIDGET_IDS];
