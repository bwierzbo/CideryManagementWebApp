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
  Pencil,
  Sparkles,
  Flame,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { EditMeasurementDialog } from "@/components/cellar/EditMeasurementDialog";
import { EditAdditiveDialog } from "@/components/cellar/EditAdditiveDialog";

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
  carbonation: Sparkles,
  pasteurize: Flame,
  label: Tag,
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
  carbonation: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  pasteurize: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  label: "bg-green-500/10 text-green-700 border-green-500/20",
};

export function BatchActivityHistory({ batchId }: BatchActivityHistoryProps) {
  const [isReversed, setIsReversed] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [editingMeasurement, setEditingMeasurement] = useState<any>(null);
  const [editingAdditive, setEditingAdditive] = useState<any>(null);

  const { data, isLoading, error, refetch } = trpc.batch.getActivityHistory.useQuery({
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
    <Card className="w-full overflow-hidden">
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
                <ArrowLeft className="h-4 w-4" />
                Oldest First
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Newest First
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        {/* Horizontal scrollable timeline */}
        <div className="relative overflow-x-scroll pb-4 px-6">
          <div className="flex gap-8 pb-2 w-max min-w-0 relative">
            {/* Horizontal timeline line - spans entire scrollable width */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-border pointer-events-none" />
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
                <div key={activity.id} className="relative flex flex-col items-center min-w-[200px]">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background mb-3",
                      colorClass,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content Card */}
                  <div
                    className={cn(
                      "w-full border rounded-lg p-3 bg-background shadow-sm",
                      hasDetails && "cursor-pointer hover:shadow-md transition-shadow"
                    )}
                    onClick={() => hasDetails && toggleActivity(activity.id)}
                  >
                    <div className="space-y-2">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", colorClass)}
                      >
                        {activity.type}
                      </Badge>

                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(activity.timestamp),
                          "MMM dd, yyyy",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(activity.timestamp),
                          "h:mm a",
                        )}
                      </p>

                      <p className="font-medium text-sm">
                        {activity.description}
                      </p>

                      {isExpanded && activity.details &&
                        typeof activity.details === "object" && (
                          <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                            {activity.details.values && (
                              <div className="text-muted-foreground">
                                {activity.details.values}
                              </div>
                            )}
                            {activity.details.amount && (
                              <div className="text-muted-foreground">
                                Amount: {activity.details.amount}
                              </div>
                            )}
                            {activity.details.volumeAdded && (
                              <div className="text-muted-foreground">
                                Added: {activity.details.volumeAdded}
                              </div>
                            )}
                            {activity.details.volumeChange && (
                              <div className="text-muted-foreground">
                                Volume: {activity.details.volumeChange}
                              </div>
                            )}
                            {activity.details.direction && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                {activity.details.direction === "incoming" ? (
                                  <>
                                    <ArrowLeft className="h-3 w-3" />
                                    <span>Incoming</span>
                                  </>
                                ) : (
                                  <>
                                    <ArrowRight className="h-3 w-3" />
                                    <span>Outgoing</span>
                                  </>
                                )}
                              </div>
                            )}
                            {activity.details.notes && (
                              <div className="text-muted-foreground italic">
                                {activity.details.notes}
                              </div>
                            )}
                            {activity.details.initialVolume && (
                              <div className="text-muted-foreground">
                                Initial: {activity.details.initialVolume}
                                {activity.details.vessel && ` in ${activity.details.vessel}`}
                              </div>
                            )}
                            {activity.details.filterType && (
                              <div className="space-y-1">
                                <div className="text-muted-foreground capitalize">
                                  {activity.details.filterType}
                                </div>
                                {activity.details.volumeBefore && (
                                  <div className="text-muted-foreground">
                                    Before: {activity.details.volumeBefore}
                                  </div>
                                )}
                                {activity.details.volumeAfter && (
                                  <div className="text-muted-foreground">
                                    After: {activity.details.volumeAfter}
                                  </div>
                                )}
                                {activity.details.volumeLoss && (
                                  <div className="text-muted-foreground">
                                    Loss: <span className="text-red-600 font-medium">{activity.details.volumeLoss}</span>
                                    {activity.details.lossPercentage && ` (${activity.details.lossPercentage})`}
                                  </div>
                                )}
                              </div>
                            )}
                            {activity.details.fromVessel && activity.details.toVessel && (
                              <div className="space-y-1">
                                {activity.details.volumeBefore && (
                                  <div className="text-muted-foreground">
                                    Before: {activity.details.volumeBefore}
                                  </div>
                                )}
                                {activity.details.volumeAfter && (
                                  <div className="text-muted-foreground">
                                    After: {activity.details.volumeAfter}
                                  </div>
                                )}
                                {activity.details.volumeLoss && (
                                  <div className="text-muted-foreground">
                                    Loss: <span className="text-red-600 font-medium">{activity.details.volumeLoss}</span>
                                    {activity.details.lossPercentage && ` (${activity.details.lossPercentage})`}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Carbonation-specific details */}
                            {activity.details.process && (
                              <div className="text-muted-foreground capitalize">
                                Process: {activity.details.process}
                              </div>
                            )}
                            {activity.details.targetCo2 && (
                              <div className="text-muted-foreground">
                                Target: {activity.details.targetCo2}
                              </div>
                            )}
                            {activity.details.finalCo2 && (
                              <div className="text-muted-foreground">
                                Final: {activity.details.finalCo2}
                              </div>
                            )}
                            {activity.details.pressure && (
                              <div className="text-muted-foreground">
                                Pressure: {activity.details.pressure}
                              </div>
                            )}
                            {activity.details.volume && (
                              <div className="text-muted-foreground">
                                Volume: {activity.details.volume}
                              </div>
                            )}
                            {activity.details.status && (
                              <div className="text-muted-foreground capitalize">
                                Status: {activity.details.status}
                              </div>
                            )}

                            {/* Pasteurization-specific details */}
                            {activity.details.temperature && (
                              <div className="text-muted-foreground">
                                Temp: {activity.details.temperature}
                              </div>
                            )}
                            {activity.details.time && (
                              <div className="text-muted-foreground">
                                Time: {activity.details.time}
                              </div>
                            )}
                            {activity.details.pasteurizationUnits && (
                              <div className="text-muted-foreground">
                                PU: {activity.details.pasteurizationUnits}
                              </div>
                            )}

                            {/* Labeling-specific details */}
                            {activity.details.unitsLabeled && (
                              <div className="text-muted-foreground">
                                Units: {activity.details.unitsLabeled}
                              </div>
                            )}

                            {/* Edit button for measurements and additives */}
                            {(activity.type === "measurement" || activity.type === "additive") && activity.metadata && (
                              <div className="mt-2 pt-2 border-t">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (activity.type === "measurement") {
                                      setEditingMeasurement(activity.metadata);
                                    } else if (activity.type === "additive") {
                                      setEditingAdditive(activity.metadata);
                                    }
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <Pencil className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Expand/Collapse indicator */}
                      {hasDetails && (
                        <div className="mt-2 flex justify-center">
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
          <div className="mt-8 pt-6 border-t px-6">
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

      {/* Edit Dialogs */}
      <EditMeasurementDialog
        measurement={editingMeasurement}
        open={!!editingMeasurement}
        onClose={() => setEditingMeasurement(null)}
        onSuccess={() => {
          refetch();
          setEditingMeasurement(null);
        }}
      />

      <EditAdditiveDialog
        additive={editingAdditive}
        open={!!editingAdditive}
        onClose={() => setEditingAdditive(null)}
        onSuccess={() => {
          refetch();
          setEditingAdditive(null);
        }}
      />
    </Card>
  );
}
