"use client";

import Link from "next/link";
import { ClipboardList, Beaker, AlertTriangle, Clock, CheckCircle, Wine, CalendarClock } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TaskItemProps {
  batchNumber: string;
  customName: string | null;
  vesselName: string | null;
  daysSince: number;
  priority: "high" | "medium" | "low";
  taskType: "measurement_needed" | "stalled_fermentation" | "confirm_terminal" | "sensory_check_due" | "check_in_due";
  percentFermented: number;
  fermentationStage: string;
  recommendedAction: string;
  compact?: boolean;
  batchId: string;
}

function getStageLabel(stage: string): string {
  switch (stage) {
    case "early": return "Early";
    case "mid": return "Mid";
    case "approaching_dry": return "Near Dry";
    case "terminal": return "Terminal";
    default: return "Unknown";
  }
}

function getTaskTypeLabel(taskType: string): string {
  switch (taskType) {
    case "stalled_fermentation": return "Stalled";
    case "confirm_terminal": return "Confirm FG";
    case "measurement_needed": return "Measure";
    case "sensory_check_due": return "Sensory";
    case "check_in_due": return "Check In";
    default: return "Action";
  }
}

function TaskItem({
  batchNumber,
  customName,
  vesselName,
  daysSince,
  priority,
  taskType,
  percentFermented,
  fermentationStage,
  recommendedAction,
  compact,
  batchId,
}: TaskItemProps) {
  const priorityColors = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const taskTypeIcons: Record<TaskItemProps["taskType"], React.ReactNode> = {
    stalled_fermentation: <AlertTriangle className="w-3 h-3" />,
    confirm_terminal: <CheckCircle className="w-3 h-3" />,
    measurement_needed: <Beaker className="w-3 h-3" />,
    sensory_check_due: <Wine className="w-3 h-3" />,
    check_in_due: <CalendarClock className="w-3 h-3" />,
  };

  return (
    <Link
      href={`/batch/${batchId}`}
      className={cn(
        "block rounded-lg hover:bg-gray-50 transition-colors",
        compact ? "p-2" : "p-3"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border shrink-0",
              priorityColors[priority],
              compact ? "w-6 h-6" : "w-8 h-8"
            )}
          >
            {taskTypeIcons[taskType]}
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
            {vesselName && !compact && (
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
          {getTaskTypeLabel(taskType)}
        </Badge>
      </div>

      {/* Fermentation progress */}
      <div className={cn("mt-2", compact && "mt-1")}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">
            {getStageLabel(fermentationStage)} • {percentFermented.toFixed(0)}%
          </span>
          <span className="text-xs text-gray-400">
            {daysSince}d since last
          </span>
        </div>
        <Progress value={Math.min(100, percentFermented)} className="h-1.5" />
      </div>

      {/* Recommended action - only show in non-compact mode */}
      {!compact && recommendedAction && (
        <p className="text-xs text-gray-500 mt-1 truncate" title={recommendedAction}>
          {recommendedAction}
        </p>
      )}
    </Link>
  );
}

/**
 * Today's Tasks Widget
 * Shows batches needing measurement based on fermentation stage,
 * stalled fermentations, and other actionable items
 */
export function TodaysTasksWidget({ compact, limit = 5, onRefresh }: WidgetProps) {
  const { data, isPending, isFetching, error, refetch } = trpc.dashboard.getTasks.useQuery({
    limit: limit,
  });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const tasks = data?.tasks ?? [];
  const totalCount = data?.totalCount ?? 0;

  // Count by task type for summary
  const stalledCount = tasks.filter(t => t.taskType === "stalled_fermentation").length;
  const confirmCount = tasks.filter(t => t.taskType === "confirm_terminal").length;

  return (
    <WidgetWrapper
      title="Tasks"
      icon={ClipboardList}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={tasks.length === 0}
      emptyState={
        <div className="text-center py-4">
          <ClipboardList className="w-8 h-8 mx-auto text-green-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium">All caught up!</p>
          <p className="text-xs text-gray-500">No batches need attention</p>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-1">
          {stalledCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5">
              {stalledCount} stalled
            </Badge>
          )}
          {totalCount > tasks.length && (
            <Badge variant="secondary" className="text-xs">
              +{totalCount - tasks.length} more
            </Badge>
          )}
        </div>
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
            taskType={task.taskType}
            percentFermented={task.percentFermented}
            fermentationStage={task.fermentationStage}
            recommendedAction={task.recommendedAction}
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
