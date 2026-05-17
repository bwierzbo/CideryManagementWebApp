"use client";

import { useState } from "react";
import Link from "next/link";
import { History, Plus, Pencil, Trash2, RotateCcw, User, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/utils/trpc";
import { WidgetWrapper } from "./WidgetWrapper";
import { WidgetProps, WidgetConfig } from "./types";
import { registerWidget, WIDGET_IDS } from "./registry";
import { cn } from "@/lib/utils";

const COLLAPSED_LIMIT = 5;
const EXPANDED_LIMIT = 10;

const OPERATION_ICON: Record<
  string,
  { icon: React.ElementType; className: string }
> = {
  create: { icon: Plus, className: "bg-green-100 text-green-700 border-green-200" },
  update: { icon: Pencil, className: "bg-blue-100 text-blue-700 border-blue-200" },
  delete: { icon: Trash2, className: "bg-red-100 text-red-700 border-red-200" },
  soft_delete: { icon: Trash2, className: "bg-orange-100 text-orange-700 border-orange-200" },
  restore: { icon: RotateCcw, className: "bg-purple-100 text-purple-700 border-purple-200" },
};

/**
 * Build a destination URL for an audit log entry, when one is sensible.
 * Returns null for entries that don't have a clear single-page destination.
 */
function hrefFor(tableName: string, recordId: string): string | null {
  switch (tableName) {
    case "batches":
      return `/batch/${recordId}`;
    case "press_runs":
    case "press_run_loads":
      return `/pressing/${recordId}`;
    case "vessels":
      return `/cellar`;
    case "vendors":
      return `/vendors`;
    case "basefruit_purchases":
    case "basefruit_purchase_items":
    case "juice_purchases":
    case "juice_purchase_items":
    case "additive_purchases":
    case "packaging_purchases":
      return `/purchasing`;
    case "bottle_runs":
    case "keg_fills":
      return `/packaging`;
    case "inventory_items":
      return `/inventory`;
    case "sales":
    case "sale_items":
      return `/sales`;
    default:
      return null;
  }
}

export function RecentActivityWidget({ compact, onRefresh }: WidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  const limit = expanded ? EXPANDED_LIMIT : COLLAPSED_LIMIT;
  const offset = expanded ? page * EXPANDED_LIMIT : 0;

  const { data, isPending, isFetching, error, refetch } =
    trpc.dashboard.getRecentActivity.useQuery({ limit, offset });

  const handleRefresh = () => {
    refetch();
    onRefresh?.();
  };

  const items = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  return (
    <WidgetWrapper
      title="Recent Activity"
      icon={History}
      compact={compact}
      isLoading={isPending}
      error={error as Error | null}
      onRetry={handleRefresh}
      onRefresh={handleRefresh}
      isRefreshing={isFetching}
      showRefresh
      isEmpty={items.length === 0 && page === 0}
      emptyMessage="No recent activity yet"
    >
      <div className={cn("divide-y divide-gray-100", compact ? "-mx-2" : "-mx-3")}>
        {items.map((item) => {
          const op = OPERATION_ICON[item.operation] ?? OPERATION_ICON.update;
          const OpIcon = op.icon;
          // Only link if the record still exists (not soft-deleted) and the
          // table has a sensible destination page.
          const href = item.linkable ? hrefFor(item.tableName, item.recordId) : null;
          const when = formatDistanceToNow(new Date(item.changedAt), { addSuffix: true });

          const row = (
            <div
              className={cn(
                "flex items-start gap-3",
                compact ? "px-2 py-2" : "px-3 py-2.5",
                href && "hover:bg-gray-50 transition-colors",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-md border shrink-0 mt-0.5",
                  op.className,
                  compact ? "w-6 h-6" : "w-7 h-7",
                )}
              >
                <OpIcon className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium text-gray-900", compact ? "text-xs" : "text-sm")}>
                  {item.message}
                </p>
                <div className={cn("flex items-center gap-2 text-gray-500 mt-0.5", compact ? "text-[10px]" : "text-xs")}>
                  <span className="flex items-center gap-1 truncate">
                    <User className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    {item.userName}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="shrink-0">{when}</span>
                </div>
              </div>
            </div>
          );

          return href ? (
            <Link key={item.id} href={href} className="block">
              {row}
            </Link>
          ) : (
            <div key={item.id}>{row}</div>
          );
        })}
      </div>

      {/* Footer controls: collapsed → "View all"; expanded → pagination + "Show less" */}
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
            View all activity →
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
            Newer
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
            Older
            <ChevronRight className={cn(compact ? "w-3 h-3" : "w-4 h-4")} />
          </button>
        </div>
      )}
    </WidgetWrapper>
  );
}

const config: WidgetConfig = {
  id: WIDGET_IDS.RECENT_ACTIVITY,
  title: "Recent Activity",
  description: "Latest data-entry actions across users — see where you left off",
  icon: History,
  category: "monitoring",
  component: RecentActivityWidget,
  defaultSize: "lg",
  allowedSizes: ["md", "lg", "full"],
  supportsRefresh: true,
  defaultRefreshInterval: 60000,
};

registerWidget(config);
