"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  Beaker,
  FlaskConical,
  Plus,
  Calendar,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Package,
  AlertCircle,
  Droplets,
  TestTube,
  Thermometer,
  Scale,
  Filter,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";

interface BatchActivityHistoryProps {
  batchId: string;
}

const activityIcons = {
  creation: Beaker,
  measurement: TestTube,
  additive: Plus,
  merge: Droplets,
  transfer: ArrowRight,
  rack: FlaskConical,
  bottling: Package,
  filter: Filter,
};

const activityColors = {
  creation: "bg-green-500/10 text-green-700 border-green-500/20",
  measurement: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  additive: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  merge: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  transfer: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  rack: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  bottling: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  filter: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
};

export function BatchActivityHistory({ batchId }: BatchActivityHistoryProps) {
  const [isReversed, setIsReversed] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const { data, isLoading, error } = trpc.batch.getActivityHistory.useQuery({
    batchId,
  });

  const toggleActivity = (activityId: string) => {
    setExpandedActivities(prev => {
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load batch history</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const activities = data?.activities || [];
  const batch = data?.batch;

  // Apply sorting based on toggle state
  const sortedActivities = isReversed ? [...activities].reverse() : activities;

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            No activity history available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity History
            </CardTitle>
            <CardDescription>
              Complete timeline of all batch events
            </CardDescription>
          </div>
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
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {sortedActivities.map((activity, index) => {
              const Icon =
                activityIcons[activity.type as keyof typeof activityIcons] ||
                Activity;
              const colorClass =
                activityColors[activity.type as keyof typeof activityColors] ||
                "bg-gray-500/10 text-gray-700 border-gray-500/20";
              const isExpanded = expandedActivities.has(activity.id);
              const hasDetails = activity.details && typeof activity.details === "object" && Object.keys(activity.details).length > 0;

              return (
                <div key={activity.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background",
                      colorClass,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <div
                      className={cn(
                        "flex items-start justify-between gap-2",
                        hasDetails && "cursor-pointer hover:bg-gray-50 rounded-lg p-2 -ml-2 transition-colors"
                      )}
                      onClick={() => hasDetails && toggleActivity(activity.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", colorClass)}
                          >
                            {activity.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(
                              new Date(activity.timestamp),
                              "MMM dd, yyyy 'at' h:mm a",
                            )}
                          </span>
                        </div>

                        <p className="font-medium text-sm">
                          {activity.description}
                        </p>

                        {isExpanded && activity.details &&
                          typeof activity.details === "object" && (
                            <div className="mt-2 space-y-1">
                              {activity.details.values && (
                                <div className="text-sm text-muted-foreground">
                                  {activity.details.values}
                                </div>
                              )}
                              {activity.details.amount && (
                                <div className="text-sm text-muted-foreground">
                                  Amount: {activity.details.amount}
                                </div>
                              )}
                              {activity.details.volumeAdded && (
                                <div className="text-sm text-muted-foreground">
                                  Added: {activity.details.volumeAdded}
                                </div>
                              )}
                              {activity.details.volumeChange && (
                                <div className="text-sm text-muted-foreground">
                                  Volume: {activity.details.volumeChange}
                                </div>
                              )}
                              {activity.details.direction && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  {activity.details.direction === "incoming" ? (
                                    <>
                                      <ArrowLeft className="h-3 w-3" />
                                      <span>Incoming transfer</span>
                                    </>
                                  ) : (
                                    <>
                                      <ArrowRight className="h-3 w-3" />
                                      <span>Outgoing transfer</span>
                                    </>
                                  )}
                                </div>
                              )}
                              {activity.details.notes && (
                                <div className="text-sm text-muted-foreground italic">
                                  Note: {activity.details.notes}
                                </div>
                              )}
                              {activity.details.initialVolume && (
                                <div className="text-sm text-muted-foreground">
                                  Initial volume:{" "}
                                  {activity.details.initialVolume}
                                  {activity.details.vessel
                                    ? ` in ${activity.details.vessel}`
                                    : ""}
                                </div>
                              )}
                              {activity.details.filterType && (
                                <div className="space-y-1">
                                  <div className="text-sm text-muted-foreground capitalize">
                                    Filter Type: <span className="font-medium">{activity.details.filterType}</span>
                                  </div>
                                  {activity.details.volumeBefore && (
                                    <div className="text-sm text-muted-foreground">
                                      Before: {activity.details.volumeBefore}
                                    </div>
                                  )}
                                  {activity.details.volumeAfter && (
                                    <div className="text-sm text-muted-foreground">
                                      After: {activity.details.volumeAfter}
                                    </div>
                                  )}
                                  {activity.details.volumeLoss && (
                                    <div className="text-sm text-muted-foreground">
                                      Loss: <span className="text-red-600 font-medium">{activity.details.volumeLoss}</span>
                                      {activity.details.lossPercentage && (
                                        <span className="ml-1">({activity.details.lossPercentage})</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              {activity.details.fromVessel && activity.details.toVessel && (
                                <div className="space-y-1">
                                  {activity.details.volumeBefore && (
                                    <div className="text-sm text-muted-foreground">
                                      Before: {activity.details.volumeBefore}
                                    </div>
                                  )}
                                  {activity.details.volumeAfter && (
                                    <div className="text-sm text-muted-foreground">
                                      After: {activity.details.volumeAfter}
                                    </div>
                                  )}
                                  {activity.details.volumeLoss && (
                                    <div className="text-sm text-muted-foreground">
                                      Loss: <span className="text-red-600 font-medium">{activity.details.volumeLoss}</span>
                                      {activity.details.lossPercentage && (
                                        <span className="ml-1">({activity.details.lossPercentage})</span>
                                      )}
                                    </div>
                                  )}
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

        {/* Summary stats */}
        {batch && (
          <div className="mt-8 pt-6 border-t">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Current Status:</span>
                <Badge
                  className="ml-2"
                  variant={["fermentation", "aging", "conditioning"].includes(batch.status) ? "default" : "secondary"}
                >
                  {batch.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Current Volume:</span>
                <span className="ml-2 font-medium">
                  {batch.currentVolume}L
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Events:</span>
                <span className="ml-2 font-medium">{activities.length}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
