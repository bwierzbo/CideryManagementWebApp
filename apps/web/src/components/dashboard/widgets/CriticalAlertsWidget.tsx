"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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
      icon: <Clock className="w-4 h-4 text-blue-600" />,
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
 * Shows critical alerts that need immediate attention
 */
export function CriticalAlertsWidget({ compact, onRefresh }: WidgetProps) {
  // Get tasks data to check for overdue measurements
  const { data: tasksData, isPending: tasksPending } = trpc.dashboard.getTasks.useQuery({
    measurementThresholdDays: 7, // Only show really overdue ones as critical
    limit: 5,
  });

  const isLoading = tasksPending;

  // Build alerts from available data
  const alerts: AlertItemProps[] = [];

  // Add critical alerts for very overdue measurements (7+ days)
  if (tasksData?.tasks) {
    const criticalTasks = tasksData.tasks.filter((t) => t.priority === "high");
    if (criticalTasks.length > 0) {
      alerts.push({
        type: "critical",
        title: `${criticalTasks.length} batch${criticalTasks.length > 1 ? "es" : ""} overdue for measurement`,
        description: `Last measured ${criticalTasks[0].daysSinceLastMeasurement}+ days ago`,
        link: "/cellar",
      });
    }

    // Add warnings for moderately overdue (5-6 days)
    const warningTasks = tasksData.tasks.filter((t) => t.priority === "medium");
    if (warningTasks.length > 0) {
      alerts.push({
        type: "warning",
        title: `${warningTasks.length} batch${warningTasks.length > 1 ? "es" : ""} need measurement soon`,
        description: "Approaching measurement threshold",
        link: "/cellar",
      });
    }
  }

  const handleRefresh = () => {
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
          <p className="text-xs text-gray-500">No critical alerts</p>
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
