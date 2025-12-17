"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Package,
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Pencil,
  Beaker,
  FlaskConical,
  ExternalLink,
} from "lucide-react";
import { formatDateTime } from "@/utils/date-format";
import { cn } from "@/lib/utils";

export interface ActivityEvent {
  id: string;
  type: "usage" | "adjustment" | "edit" | "creation";
  timestamp: Date | string;
  description: string;
  details: {
    quantity?: number;
    unit?: string;
    linkedEntity?: { id: string; name: string; type: string };
    notes?: string;
  };
}

interface ActivityHistoryProps {
  activities: ActivityEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
}

const activityIcons = {
  usage: Package,
  adjustment: Pencil,
  edit: Pencil,
  creation: Plus,
};

const activityColors = {
  usage: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  adjustment: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  edit: "bg-gray-500/10 text-gray-700 border-gray-500/20",
  creation: "bg-green-500/10 text-green-700 border-green-500/20",
};

const activityLabels = {
  usage: "Used",
  adjustment: "Adjusted",
  edit: "Edited",
  creation: "Created",
};

export function ActivityHistory({
  activities,
  isLoading,
  emptyMessage = "No activity history available",
}: ActivityHistoryProps) {
  const [isReversed, setIsReversed] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(
    new Set()
  );

  const toggleActivity = (activityId: string) => {
    setExpandedActivities((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Apply sorting based on toggle state
  const sortedActivities = isReversed ? [...activities].reverse() : activities;

  return (
    <div className="space-y-4">
      {/* Sort toggle */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsReversed(!isReversed)}
          className="flex items-center gap-2"
        >
          {isReversed ? (
            <>
              <ArrowUp className="h-4 w-4" />
              Oldest First
            </>
          ) : (
            <>
              <ArrowDown className="h-4 w-4" />
              Newest First
            </>
          )}
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {sortedActivities.map((activity) => {
            const Icon =
              activityIcons[activity.type as keyof typeof activityIcons] ||
              Activity;
            const colorClass =
              activityColors[activity.type as keyof typeof activityColors] ||
              "bg-gray-500/10 text-gray-700 border-gray-500/20";
            const label =
              activityLabels[activity.type as keyof typeof activityLabels] ||
              activity.type;
            const isExpanded = expandedActivities.has(activity.id);
            const hasDetails =
              activity.details &&
              (activity.details.notes || activity.details.linkedEntity);

            return (
              <div key={activity.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background shrink-0",
                    colorClass
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1 min-w-0">
                  <div
                    className={cn(
                      "flex items-start justify-between gap-2",
                      hasDetails &&
                        "cursor-pointer hover:bg-gray-50 rounded-lg p-2 -ml-2 transition-colors"
                    )}
                    onClick={() => hasDetails && toggleActivity(activity.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", colorClass)}
                        >
                          {label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(activity.timestamp)}
                        </span>
                      </div>

                      <p className="font-medium text-sm break-words">
                        {activity.description}
                      </p>

                      {isExpanded && (
                        <div className="mt-2 space-y-1">
                          {activity.details.linkedEntity && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              {activity.details.linkedEntity.type === "batch" ? (
                                <FlaskConical className="h-3 w-3" />
                              ) : activity.details.linkedEntity.type ===
                                "pressRun" ? (
                                <Beaker className="h-3 w-3" />
                              ) : (
                                <ExternalLink className="h-3 w-3" />
                              )}
                              <span>
                                {activity.details.linkedEntity.type === "batch"
                                  ? "Batch: "
                                  : activity.details.linkedEntity.type ===
                                    "pressRun"
                                  ? "Press Run: "
                                  : ""}
                                {activity.details.linkedEntity.name}
                              </span>
                            </div>
                          )}
                          {activity.details.notes && (
                            <div className="text-sm text-muted-foreground italic">
                              Note: {activity.details.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {hasDetails && (
                      <div className="flex-shrink-0 ml-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
