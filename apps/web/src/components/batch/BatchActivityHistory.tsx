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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  BarChart3,
  List,
} from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { EditMeasurementDialog } from "@/components/cellar/EditMeasurementDialog";
import { EditAdditiveDialog } from "@/components/cellar/EditAdditiveDialog";
import { EditDateDialog } from "@/components/cellar/EditDateDialog";
import { MeasurementChart } from "@/components/batch/MeasurementChart";

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
  const [editingDate, setEditingDate] = useState<{
    eventType: any;
    eventId: string;
    currentDate: Date | string;
    label: string;
  } | null>(null);

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

  // Extract measurements for chart/list views
  const measurements = activities
    .filter(a => a.type === 'measurement' && a.metadata)
    .map(a => a.metadata)
    .filter(Boolean);

  // Extract additives and transfers for list view
  const additives = activities.filter(a => a.type === 'additive');
  const transfers = activities.filter(a => a.type === 'transfer');

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
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="timeline" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="timeline">
                <Activity className="w-4 h-4 mr-2" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="chart">
                <BarChart3 className="w-4 h-4 mr-2" />
                Chart
              </TabsTrigger>
              <TabsTrigger value="list">
                <List className="w-4 h-4 mr-2" />
                List
              </TabsTrigger>
            </TabsList>
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

          {/* Timeline Tab */}
          <TabsContent value="timeline">
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

                              {/* Edit buttons for all event types */}
                              {activity.metadata && (
                                <div className="mt-2 pt-2 border-t">
                                  {activity.type === "measurement" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingMeasurement(activity.metadata);
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Measurement
                                    </Button>
                                  )}
                                  {activity.type === "additive" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAdditive(activity.metadata);
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Additive
                                    </Button>
                                  )}
                                  {activity.type === "transfer" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "transfer",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.transferredAt,
                                          label: "Transfer Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
                                  )}
                                  {activity.type === "rack" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "rack",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.rackedAt,
                                          label: "Racking Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
                                  )}
                                  {activity.type === "filter" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "filter",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.filteredAt,
                                          label: "Filter Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
                                  )}
                                  {activity.type === "merge" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "merge",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.mergedAt,
                                          label: "Merge Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
                                  )}
                                  {activity.type === "carbonation" && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingDate({
                                            eventType: "carbonation_start",
                                            eventId: activity.metadata.id,
                                            currentDate: activity.metadata.startedAt,
                                            label: "Carbonation Start Date",
                                          });
                                        }}
                                        className="h-8"
                                      >
                                        <Pencil className="h-3 w-3 mr-2" />
                                        Edit Start Date
                                      </Button>
                                      {activity.metadata.completedAt && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingDate({
                                              eventType: "carbonation_complete",
                                              eventId: activity.metadata.id,
                                              currentDate: activity.metadata.completedAt,
                                              label: "Carbonation Complete Date",
                                            });
                                          }}
                                          className="h-8"
                                        >
                                          <Pencil className="h-3 w-3 mr-2" />
                                          Edit Complete Date
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                  {activity.type === "bottling" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "bottling",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.packagedAt,
                                          label: "Bottling Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
                                  )}
                                  {activity.type === "pasteurize" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "pasteurize",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.pasteurizedAt,
                                          label: "Pasteurization Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
                                  )}
                                  {activity.type === "label" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDate({
                                          eventType: "label",
                                          eventId: activity.metadata.id,
                                          currentDate: activity.metadata.labeledAt,
                                          label: "Labeling Date",
                                        });
                                      }}
                                      className="h-8"
                                    >
                                      <Pencil className="h-3 w-3 mr-2" />
                                      Edit Date
                                    </Button>
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
          </TabsContent>

          {/* Chart Tab */}
          <TabsContent value="chart">
            {measurements.length > 0 ? (
              <MeasurementChart measurements={measurements} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TestTube className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No measurements recorded yet</p>
              </div>
            )}
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list">
            <div className="space-y-4">
              {/* Measurements */}
              {measurements.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-600 mb-2">
                    Measurements ({measurements.length})
                  </h3>
                  <div className="border-l-2 border-green-500 pl-4 space-y-2">
                    {measurements.map((m: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(m.measurementDate), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <div className="text-gray-700">
                          {m.abv && `ABV: ${m.abv}%`}
                          {m.specificGravity && ` • SG: ${parseFloat(m.specificGravity).toFixed(3)}`}
                          {m.ph && ` • pH: ${m.ph}`}
                          {m.temperature && ` • ${m.temperature}°C`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additives */}
              {additives.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-purple-600 mb-2">
                    Additives ({additives.length})
                  </h3>
                  <div className="border-l-2 border-purple-500 pl-4 space-y-2">
                    {additives.map((a: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(a.timestamp), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <div className="text-gray-700">{a.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transfers */}
              {transfers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-600 mb-2">
                    Transfers ({transfers.length})
                  </h3>
                  <div className="border-l-2 border-orange-500 pl-4 space-y-2">
                    {transfers.map((t: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(t.timestamp), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <div className="text-gray-700">{t.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {measurements.length === 0 && additives.length === 0 && transfers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <List className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              )}
            </div>
          </TabsContent>

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
        </Tabs>
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

      {editingDate && (
        <EditDateDialog
          open={true}
          onClose={() => setEditingDate(null)}
          onSuccess={() => {
            refetch();
            setEditingDate(null);
          }}
          eventType={editingDate.eventType}
          eventId={editingDate.eventId}
          currentDate={editingDate.currentDate}
          dateFieldLabel={editingDate.label}
        />
      )}
    </Card>
  );
}
