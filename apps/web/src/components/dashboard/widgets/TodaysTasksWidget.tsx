"use client";

import Link from "next/link";
import { ClipboardList, Beaker, AlertTriangle, Clock } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TaskItemProps {
  batchNumber: string;
  customName: string | null;
  vesselName: string | null;
  daysSince: number;
  priority: "high" | "medium" | "low";
  compact?: boolean;
  batchId: string;
}

function TaskItem({
  batchNumber,
  customName,
  vesselName,
  daysSince,
  priority,
  compact,
  batchId,
}: TaskItemProps) {
  const priorityColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const priorityIcons = {
    high: <AlertTriangle className="w-3 h-3" />,
    medium: <Clock className="w-3 h-3" />,
    low: <Beaker className="w-3 h-3" />,
  };

  return (
    <Link
      href={`/batch/${batchId}`}
      className={cn(
        "flex items-center justify-between rounded-lg hover:bg-gray-50 transition-colors",
        compact ? "p-2" : "p-3"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border",
            priorityColors[priority],
            compact ? "w-7 h-7" : "w-9 h-9"
          )}
        >
          {priorityIcons[priority]}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "font-medium text-gray-900 truncate",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {customName || batchNumber}
          </p>
          {vesselName && (
            <p className="text-xs text-gray-500 truncate">{vesselName}</p>
          )}
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "ml-2 shrink-0",
          priorityColors[priority],
          compact && "text-xs px-1.5 py-0"
        )}
      >
        {daysSince}d ago
      </Badge>
    </Link>
  );
}

/**
 * Today's Tasks Widget
 * Shows batches needing measurement and other actionable items
 */
export function TodaysTasksWidget({ compact, limit = 5, onRefresh }: WidgetProps) {
  const { data, isPending, error, refetch } = trpc.dashboard.getTasks.useQuery({
    measurementThresholdDays: 3,
    limit: limit,
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const tasks = data?.tasks ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <WidgetWrapper
      title="Tasks"
      icon={ClipboardList}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      showRefresh
      isEmpty={tasks.length === 0}
      emptyState={
        <div className="text-center py-4">
          <ClipboardList className="w-8 h-8 mx-auto text-green-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium">All caught up!</p>
          <p className="text-xs text-gray-500">No batches need measurement</p>
        </div>
      }
      headerActions={
        totalCount > tasks.length ? (
          <Badge variant="secondary" className="text-xs">
            +{totalCount - tasks.length} more
          </Badge>
        ) : null
      }
    >
      <div className={cn("divide-y", compact ? "-mx-2" : "-mx-3")}>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            batchId={task.id}
            batchNumber={task.batchNumber}
            customName={task.customName}
            vesselName={task.vesselName}
            daysSince={task.daysSinceLastMeasurement}
            priority={task.priority}
            compact={compact}
          />
        ))}
      </div>
      {totalCount > tasks.length && (
        <div className="mt-3 text-center">
          <Link
            href="/cellar"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            View all {totalCount} tasks →
          </Link>
        </div>
      )}
    </WidgetWrapper>
  );
}

// Register the widget
const config: WidgetConfig = {
  id: WIDGET_IDS.TODAYS_TASKS,
  title: "Today's Tasks",
  description: "Batches needing measurement and other action items",
  icon: ClipboardList,
  category: "actions",
  component: TodaysTasksWidget,
  defaultSize: "md",
  allowedSizes: ["sm", "md", "lg"],
  supportsRefresh: true,
  defaultRefreshInterval: 60000,
};

registerWidget(config);
