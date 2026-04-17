"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Beaker,
  AlertTriangle,
  CheckCircle,
  Wine,
  CalendarClock,
  Loader2,
  ClipboardList,
} from "lucide-react";

const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
};

const taskTypeIcons: Record<string, React.ReactNode> = {
  stalled_fermentation: <AlertTriangle className="w-4 h-4" />,
  confirm_terminal: <CheckCircle className="w-4 h-4" />,
  measurement_needed: <Beaker className="w-4 h-4" />,
  sensory_check_due: <Wine className="w-4 h-4" />,
  check_in_due: <CalendarClock className="w-4 h-4" />,
  sg_due: <Beaker className="w-4 h-4" />,
  ph_due: <Beaker className="w-4 h-4" />,
  temperature_due: <CalendarClock className="w-4 h-4" />,
  sensory_due: <Wine className="w-4 h-4" />,
  volume_due: <Beaker className="w-4 h-4" />,
};

const taskTypeLabels: Record<string, string> = {
  stalled_fermentation: "Stalled Fermentation",
  confirm_terminal: "Confirm Final Gravity",
  measurement_needed: "Measurement Needed",
  sensory_check_due: "Sensory Check Due",
  check_in_due: "Check In Due",
  sg_due: "SG Reading Due",
  ph_due: "pH Check Due",
  temperature_due: "Temperature Check Due",
  sensory_due: "Sensory Evaluation Due",
  volume_due: "Volume Check Due",
};

const stageLabels: Record<string, string> = {
  early: "Early",
  mid: "Mid",
  approaching_dry: "Near Dry",
  terminal: "Terminal",
  unknown: "Unknown",
};

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <TasksPageContent />
    </Suspense>
  );
}

function TasksPageContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  const { data, isLoading } = trpc.dashboard.getTasks.useQuery({
    limit: 200,
  });

  const allTasks = data?.tasks ?? [];

  // Apply filter from URL params
  const tasks = filterParam
    ? allTasks.filter((t) => {
        if (filterParam === "high") return t.priority === "high";
        if (filterParam === "medium") return t.priority === "medium";
        if (filterParam === "stalled_fermentation") return t.taskType === "stalled_fermentation";
        if (filterParam === "confirm_terminal") return t.taskType === "confirm_terminal";
        return t.taskType === filterParam || t.priority === filterParam;
      })
    : allTasks;

  const stalledCount = tasks.filter(
    (t) => t.taskType === "stalled_fermentation",
  ).length;
  const highCount = tasks.filter((t) => t.priority === "high").length;
  const mediumCount = tasks.filter((t) => t.priority === "medium").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ClipboardList className="w-8 h-8" />
              All Tasks
            </h1>
            <p className="text-gray-600 mt-1">
              Batches needing attention — measurements, check-ins, and alerts
            </p>
          </div>
        </div>

        {/* Filter indicator */}
        {filterParam && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm text-blue-800">
              Filtered: showing {tasks.length} of {allTasks.length} tasks
            </span>
            <Link href="/dashboard/tasks">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Clear filter
              </Button>
            </Link>
          </div>
        )}

        {/* Summary */}
        <div className="flex gap-3 mb-6">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {tasks.length}{filterParam ? ` filtered` : ` total`}
          </Badge>
          {highCount > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200 text-sm px-3 py-1">
              {highCount} high priority
            </Badge>
          )}
          {mediumCount > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-sm px-3 py-1">
              {mediumCount} medium
            </Badge>
          )}
          {stalledCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              {stalledCount} stalled
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}

        {!isLoading && tasks.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" />
              <p className="text-lg font-medium text-gray-900">All caught up!</p>
              <p className="text-gray-500 mt-1">No batches need attention right now.</p>
            </CardContent>
          </Card>
        )}

        {/* Task List */}
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={`${task.id}-${task.taskType}`}
              href={`/batch/${task.id}?tab=measurements`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-lg border shrink-0 ${
                          priorityColors[task.priority]
                        }`}
                      >
                        {taskTypeIcons[task.taskType] || (
                          <Beaker className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {task.customName || task.batchNumber}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {task.vesselName || "Unassigned"} &middot;{" "}
                          {task.productType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={priorityColors[task.priority]}
                      >
                        {taskTypeLabels[task.taskType] || task.taskType}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {task.daysSinceLastMeasurement < 999
                          ? `${task.daysSinceLastMeasurement}d ago`
                          : "Never measured"}
                      </Badge>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">
                        {stageLabels[task.fermentationStage] || task.fermentationStage} &middot;{" "}
                        {task.percentFermented.toFixed(0)}% fermented
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, task.percentFermented)}
                      className="h-1.5"
                    />
                  </div>

                  {/* Recommended action */}
                  {task.recommendedAction && (
                    <p className="text-xs text-gray-500 mt-2">
                      {task.recommendedAction}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
