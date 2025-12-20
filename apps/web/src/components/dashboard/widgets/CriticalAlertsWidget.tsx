"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, AlertCircle, Clock, Beaker } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

interface AlertItemProps {
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  link?: string;
  compact?: boolean;
}

function AlertItem({ type, title, description, link, compact }: AlertItemProps) {
  const alertStyles = {
    critical: {
      bg: "bg-red-50 border-red-200",
      icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
      text: "text-red-800",
    },
    warning: {
      bg: "bg-yellow-50 border-yellow-200",
      icon: <AlertCircle className="w-4 h-4 text-yellow-600" />,
      text: "text-yellow-800",
    },
    info: {
      bg: "bg-blue-50 border-blue-200",
      icon: <Beaker className="w-4 h-4 text-blue-600" />,
      text: "text-blue-800",
    },
  };

  const style = alertStyles[type];
  const content = (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border",
        style.bg,
        compact ? "p-2" : "p-3",
        link && "hover:opacity-80 transition-opacity cursor-pointer"
      )}
    >
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div className="min-w-0">
        <p className={cn("font-medium", style.text, compact ? "text-xs" : "text-sm")}>
          {title}
        </p>
        <p className={cn("text-gray-600", compact ? "text-xs" : "text-xs")}>
          {description}
        </p>
      </div>
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}

/**
 * Critical Alerts Widget
 * Shows critical alerts based on SG-based fermentation tracking:
 * - Stalled fermentations (highest priority)
 * - Batches needing terminal confirmation
 * - Overdue measurements based on fermentation stage
 */
export function CriticalAlertsWidget({ compact, onRefresh }: WidgetProps) {
  // Get tasks data using SG-based fermentation tracking
  const { data: tasksData, isPending: tasksPending, refetch } = trpc.dashboard.getTasks.useQuery({
    limit: 20, // Get more to properly categorize
  });

  const isLoading = tasksPending;

  // Build alerts from available data based on task types
  const alerts: AlertItemProps[] = [];

  if (tasksData?.tasks) {
    // Stalled fermentations are always critical
    const stalledTasks = tasksData.tasks.filter((t) => t.taskType === "stalled_fermentation");
    if (stalledTasks.length > 0) {
      const avgPercent = Math.round(
        stalledTasks.reduce((sum, t) => sum + t.percentFermented, 0) / stalledTasks.length
      );
      alerts.push({
        type: "critical",
        title: `${stalledTasks.length} stalled fermentation${stalledTasks.length > 1 ? "s" : ""}`,
        description: `Avg ${avgPercent}% complete - consider temperature adjustment or yeast addition`,
        link: "/cellar",
      });
    }

    // High priority measurements (very overdue)
    const highPriorityMeasurements = tasksData.tasks.filter(
      (t) => t.taskType === "measurement_needed" && t.priority === "high"
    );
    if (highPriorityMeasurements.length > 0) {
      alerts.push({
        type: "critical",
        title: `${highPriorityMeasurements.length} batch${highPriorityMeasurements.length > 1 ? "es" : ""} very overdue for measurement`,
        description: `Significantly past recommended measurement schedule`,
        link: "/cellar",
      });
    }

    // Terminal confirmation needed
    const terminalTasks = tasksData.tasks.filter((t) => t.taskType === "confirm_terminal");
    if (terminalTasks.length > 0) {
      alerts.push({
        type: "warning",
        title: `${terminalTasks.length} batch${terminalTasks.length > 1 ? "es" : ""} need terminal confirmation`,
        description: "Take another hydrometer reading to confirm final gravity",
        link: "/cellar",
      });
    }

    // Medium priority measurements (due based on stage)
    const mediumPriorityMeasurements = tasksData.tasks.filter(
      (t) => t.taskType === "measurement_needed" && t.priority === "medium"
    );
    if (mediumPriorityMeasurements.length > 0) {
      alerts.push({
        type: "info",
        title: `${mediumPriorityMeasurements.length} batch${mediumPriorityMeasurements.length > 1 ? "es" : ""} due for measurement`,
        description: "Measurement recommended based on fermentation stage",
        link: "/cellar",
      });
    }
  }

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  return (
    <WidgetWrapper
      title="Alerts"
      icon={AlertTriangle}
      compact={compact}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={alerts.length === 0}
      emptyState={
        <div className="text-center py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium">All Clear</p>
          <p className="text-xs text-gray-500">No fermentation alerts</p>
        </div>
      }
    >
      <div className="space-y-2">
        {alerts.map((alert, index) => (
          <AlertItem key={index} {...alert} compact={compact} />
        ))}
      </div>
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.CRITICAL_ALERTS,
  title: "Critical Alerts",
  description: "Urgent issues requiring immediate attention",
  icon: AlertTriangle,
  category: "alerts",
  component: CriticalAlertsWidget,
  defaultSize: "full",
  allowedSizes: ["md", "lg", "full"],
  supportsRefresh: true,
  defaultRefreshInterval: 30000, // 30 seconds for alerts
};

registerWidget(config);
