"use client";

import { ReactNode } from "react";
import { LucideIcon, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WidgetSize, WIDGET_SIZE_CLASSES } from "./types";

interface WidgetWrapperProps {
  /** Widget title */
  title: string;
  /** Icon to display in header */
  icon: LucideIcon;
  /** Current size */
  size?: WidgetSize;
  /** Compact mode (less padding) */
  compact?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: Error | null;
  /** Callback to retry on error */
  onRetry?: () => void;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Empty state content (custom ReactNode) */
  emptyState?: ReactNode;
  /** Empty state message (simple string) */
  emptyMessage?: string;
  /** Whether data is empty */
  isEmpty?: boolean;
  /** Additional header actions */
  headerActions?: ReactNode;
  /** Widget content */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Skeleton loader for widget content
 */
function WidgetSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className={cn("bg-gray-200 rounded", compact ? "h-3" : "h-4", "w-3/4")} />
      <div className={cn("bg-gray-200 rounded", compact ? "h-3" : "h-4", "w-1/2")} />
      <div className={cn("bg-gray-200 rounded", compact ? "h-16" : "h-24")} />
    </div>
  );
}

/**
 * Error state for widget
 */
function WidgetError({
  error,
  onRetry,
  compact,
}: {
  error: Error;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("text-center", compact ? "py-4" : "py-8")}>
      <AlertCircle className={cn("mx-auto text-red-500", compact ? "w-6 h-6" : "w-8 h-8")} />
      <p className={cn("text-gray-600 mt-2", compact ? "text-xs" : "text-sm")}>
        Failed to load data
      </p>
      {error.message && (
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto truncate">
          {error.message}
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-3"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Default empty state
 */
function DefaultEmptyState({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("text-center text-gray-500", compact ? "py-4" : "py-8")}>
      <p className={compact ? "text-xs" : "text-sm"}>No data available</p>
    </div>
  );
}

/**
 * Wrapper component providing consistent chrome for all dashboard widgets.
 * Handles loading, error, and empty states automatically.
 */
export function WidgetWrapper({
  title,
  icon: Icon,
  size = "md",
  compact = false,
  isLoading = false,
  error = null,
  onRetry,
  onRefresh,
  isRefreshing = false,
  showRefresh = false,
  emptyState,
  emptyMessage,
  isEmpty = false,
  headerActions,
  children,
  className,
}: WidgetWrapperProps) {
  const sizeClass = WIDGET_SIZE_CLASSES[size];

  return (
    <Card
      className={cn(
        "bg-white border-2 border-gray-100 hover:border-gray-200 transition-all duration-200",
        sizeClass,
        className
      )}
    >
      <CardHeader className={cn("pb-2", compact ? "p-3" : "p-4")}>
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              "flex items-center gap-2",
              compact ? "text-sm" : "text-base"
            )}
          >
            <Icon className={cn(compact ? "w-4 h-4" : "w-5 h-5")} />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            {headerActions}
            {showRefresh && onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-7 w-7 p-0"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    isRefreshing && "animate-spin"
                  )}
                />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "p-3 pt-0" : "p-4 pt-0")}>
        {isLoading ? (
          <WidgetSkeleton compact={compact} />
        ) : error ? (
          <WidgetError error={error} onRetry={onRetry} compact={compact} />
        ) : isEmpty ? (
          emptyState || (emptyMessage ? (
            <div className={cn("text-center text-gray-500", compact ? "py-4" : "py-8")}>
              <p className={compact ? "text-xs" : "text-sm"}>{emptyMessage}</p>
            </div>
          ) : <DefaultEmptyState compact={compact} />)
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
