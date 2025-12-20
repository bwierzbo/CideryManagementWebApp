"use client";

import { useMemo } from "react";
import { useSortedWidgets, useDashboardStore } from "@/stores/dashboardStore";
import { widgetRegistry } from "./widgets/registry";
import { WidgetProps, WIDGET_SIZE_CLASSES } from "./widgets/types";
import { cn } from "@/lib/utils";
import { AlertCircle, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DashboardGridProps {
  /** Enable compact mode for all widgets */
  compact?: boolean;
  /** Additional className for the grid */
  className?: string;
}

/**
 * Placeholder for widgets that haven't been implemented yet
 */
function PlaceholderWidget({
  widgetId,
  size
}: {
  widgetId: string;
  size: string;
}) {
  return (
    <Card className={cn("bg-gray-50 border-2 border-dashed border-gray-200", WIDGET_SIZE_CLASSES[size as keyof typeof WIDGET_SIZE_CLASSES])}>
      <CardContent className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Settings className="w-8 h-8 mb-2" />
        <p className="text-sm font-medium">Widget: {widgetId}</p>
        <p className="text-xs">Coming soon</p>
      </CardContent>
    </Card>
  );
}

/**
 * Error boundary fallback for individual widgets
 */
function WidgetErrorFallback({
  widgetId,
  size,
  onRetry,
}: {
  widgetId: string;
  size: string;
  onRetry?: () => void;
}) {
  return (
    <Card className={cn("bg-red-50 border-2 border-red-200", WIDGET_SIZE_CLASSES[size as keyof typeof WIDGET_SIZE_CLASSES])}>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm font-medium text-red-700">
          Failed to load widget
        </p>
        <p className="text-xs text-red-500 mb-3">{widgetId}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Renders a single widget instance
 */
function WidgetRenderer({
  instanceId,
  widgetId,
  size,
  settings,
  compact,
}: {
  instanceId: string;
  widgetId: string;
  size: string;
  settings?: Record<string, unknown>;
  compact?: boolean;
}) {
  const config = widgetRegistry.get(widgetId);

  // Widget not registered yet - show placeholder
  if (!config) {
    return <PlaceholderWidget widgetId={widgetId} size={size} />;
  }

  const Component = config.component;
  const props: WidgetProps = {
    instanceId,
    compact,
    size: size as WidgetProps["size"],
    ...settings,
  };

  return <Component {...props} />;
}

/**
 * Main dashboard grid component.
 * Renders all widgets based on the current layout from the store.
 */
export function DashboardGrid({ compact = false, className }: DashboardGridProps) {
  const widgets = useSortedWidgets();
  const isEditing = useDashboardStore((state) => state.isEditing);
  const selectedWidgetId = useDashboardStore((state) => state.selectedWidgetId);
  const selectWidget = useDashboardStore((state) => state.selectWidget);
  const removeWidget = useDashboardStore((state) => state.removeWidget);

  // Memoize the grid to prevent unnecessary re-renders
  const grid = useMemo(() => {
    return widgets.map((widget) => (
      <div
        key={widget.id}
        className={cn(
          "relative",
          WIDGET_SIZE_CLASSES[widget.size],
          isEditing && "cursor-pointer",
          isEditing && selectedWidgetId === widget.id && "ring-2 ring-blue-500 ring-offset-2 rounded-lg"
        )}
        onClick={isEditing ? () => selectWidget(widget.id) : undefined}
      >
        <WidgetRenderer
          instanceId={widget.id}
          widgetId={widget.widgetId}
          size={widget.size}
          settings={widget.settings}
          compact={compact}
        />

        {/* Edit mode overlay */}
        {isEditing && (
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              variant="destructive"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                removeWidget(widget.id);
              }}
            >
              ×
            </Button>
          </div>
        )}
      </div>
    ));
  }, [widgets, compact, isEditing, selectedWidgetId, selectWidget, removeWidget]);

  if (widgets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Settings className="w-12 h-12 mx-auto mb-4" />
        <p className="text-lg font-medium">No widgets configured</p>
        <p className="text-sm">Add widgets to customize your dashboard</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
        className
      )}
    >
      {grid}
    </div>
  );
}
