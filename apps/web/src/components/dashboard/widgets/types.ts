import { LucideIcon } from "lucide-react";
import { ComponentType } from "react";

/**
 * Widget size options for responsive grid layout
 */
export type WidgetSize = "sm" | "md" | "lg" | "full";

/**
 * Widget category for grouping in the widget picker
 */
export type WidgetCategory =
  | "production"
  | "inventory"
  | "alerts"
  | "actions"
  | "reports"
  | "monitoring";

/**
 * Common props passed to all widget components
 */
export interface WidgetProps {
  /** Unique instance ID for this widget placement */
  instanceId: string;
  /** Display in compact mode (less padding, smaller text) */
  compact?: boolean;
  /** Maximum number of items to display */
  limit?: number;
  /** Optional filter by vessel */
  vesselId?: string;
  /** Optional filter by batch */
  batchId?: string;
  /** Callback when widget wants to refresh its data */
  onRefresh?: () => void;
  /** Current size of the widget */
  size?: WidgetSize;
}

/**
 * Widget configuration for the registry
 */
export interface WidgetConfig {
  /** Unique widget type identifier */
  id: string;
  /** Display name */
  title: string;
  /** Short description for widget picker */
  description: string;
  /** Icon component */
  icon: LucideIcon;
  /** Category for grouping */
  category: WidgetCategory;
  /** The widget component */
  component: ComponentType<WidgetProps>;
  /** Default size when added to dashboard */
  defaultSize: WidgetSize;
  /** Allowed sizes for this widget */
  allowedSizes: WidgetSize[];
  /** Whether this widget supports auto-refresh */
  supportsRefresh?: boolean;
  /** Default refresh interval in ms (if supportsRefresh is true) */
  defaultRefreshInterval?: number;
  /** Minimum role required to view this widget */
  minRole?: "viewer" | "operator" | "admin";
}

/**
 * Instance of a widget placed on the dashboard
 */
export interface WidgetInstance {
  /** Unique instance ID */
  id: string;
  /** Widget type (references WidgetConfig.id) */
  widgetId: string;
  /** Current size */
  size: WidgetSize;
  /** Position in the grid (for ordering) */
  order: number;
  /** Widget-specific settings */
  settings?: Record<string, unknown>;
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  /** Layout ID */
  id: string;
  /** Layout name */
  name: string;
  /** Widget instances in this layout */
  widgets: WidgetInstance[];
  /** Whether this is the default layout */
  isDefault?: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

/**
 * Grid column span for each widget size
 */
export const WIDGET_SIZE_COLS: Record<WidgetSize, number> = {
  sm: 1,
  md: 2,
  lg: 3,
  full: 4,
};

/**
 * CSS classes for widget sizes
 */
export const WIDGET_SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: "col-span-1",
  md: "col-span-1 md:col-span-2",
  lg: "col-span-1 md:col-span-2 lg:col-span-3",
  full: "col-span-1 md:col-span-2 lg:col-span-4",
};
