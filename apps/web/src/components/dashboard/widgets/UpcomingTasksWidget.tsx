"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Beaker,
  Wine,
  Thermometer,
  Droplet,
  CheckCircle,
  Hourglass,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

const COLLAPSED_LIMIT = 5;
const EXPANDED_LIMIT = 10;

const KIND_ICON: Record<string, React.ElementType> = {
  sg_reading: Beaker,
  ph_reading: Beaker,
  temperature_reading: Thermometer,
  sensory_check: Wine,
  volume_check: Droplet,
  terminal_confirmation: CheckCircle,
  aging_milestone: Hourglass,
  recipe_step: ListChecks,
};

function priorityClass(priority: string): string {
  switch (priority) {
    case "high":   return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium": return "bg-blue-100 text-blue-700 border-blue-200";
    default:       return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/**
 * Format hoursUntilDue into a short human-readable label.
 * - <1h:    "<1h"
 * - <24h:   "in Xh"
 * - <48h:   "tomorrow"
 * - >=48h:  "in N days"
 */
function formatRelative(hours: number): string {
  if (hours < 1) return "<1h";
  if (hours < 24) return `in ${Math.round(hours)}h`;
  if (hours < 48) return "tomorrow";
  const days = Math.round(hours / 24);
  return `in ${days} days`;
}

export function UpcomingTasksWidget({ compact, onRefresh }: WidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const limit = expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
  const offset = expanded ? page * EXPANDED_LIMIT : 0;

  const { data, isPending, isFetching, error, refetch } =
    trpc.dashboard.getUpcomingTasks.useQuery({ limit, offset, daysAhead: 7 });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  return (
    <WidgetWrapper
      title="Upcoming"
      icon={CalendarClock}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={items.length === 0 && page === 0}
      emptyState={
        <div className="text-center py-4">
          <CalendarClock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium">Nothing scheduled</p>
          <p className="text-xs text-gray-500">No tasks due in the next 7 days</p>
        </div>
      }
    >
      <div className={cn("divide-y divide-gray-100", compact ? "-mx-2" : "-mx-3")}>
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind] ?? CalendarClock;
          const when = formatRelative(item.hoursUntilDue);

          const row = (
            <div
              className={cn(
                "flex items-start gap-3",
                compact ? "px-2 py-2" : "px-3 py-2.5",
                item.href && "hover:bg-gray-50 transition-colors",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-md border shrink-0 mt-0.5",
                  priorityClass(item.priority),
                  compact ? "w-6 h-6" : "w-7 h-7",
                )}
              >
                <Icon className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium text-gray-900", compact ? "text-xs" : "text-sm")}>
                  {item.description}
                </p>
                <div className={cn("text-gray-500 mt-0.5", compact ? "text-[10px]" : "text-xs")}>
                  {when}
                </div>
              </div>
            </div>
          );

          return item.href ? (
            <Link key={item.id} href={item.href} className="block">
              {row}
            </Link>
          ) : (
            <div key={item.id}>{row}</div>
          );
        })}
      </div>

      {!expanded && hasMore && (
        <div className="text-center pt-3">
          <button
            onClick={() => {
              setExpanded(true);
              setPage(0);
            }}
            className={cn(
              "text-blue-600 hover:text-blue-800 font-medium",
              compact ? "text-xs" : "text-sm",
            )}
          >
            View all upcoming →
          </button>
        </div>
      )}

      {expanded && (
        <div className="flex items-center justify-between gap-2 pt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className={cn(
              "flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed",
              compact ? "text-xs" : "text-sm",
            )}
          >
            <ChevronLeft className={cn(compact ? "w-3 h-3" : "w-4 h-4")} />
            Sooner
          </button>

          <button
            onClick={() => {
              setExpanded(false);
              setPage(0);
            }}
            className={cn(
              "text-gray-500 hover:text-gray-700 font-medium",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Show less ↑
          </button>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className={cn(
              "flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Later
            <ChevronRight className={cn(compact ? "w-3 h-3" : "w-4 h-4")} />
          </button>
        </div>
      )}
    </WidgetWrapper>
  );
}

const config: WidgetConfig = {
  id: WIDGET_IDS.UPCOMING_TASKS,
  title: "Upcoming",
  description: "Tasks coming up in the next 7 days — measurements, terminal checks, recipe steps",
  icon: CalendarClock,
  category: "actions",
  component: UpcomingTasksWidget,
  defaultSize: "lg",
  allowedSizes: ["md", "lg", "full"],
  supportsRefresh: true,
  defaultRefreshInterval: 120000,
};

registerWidget(config);
