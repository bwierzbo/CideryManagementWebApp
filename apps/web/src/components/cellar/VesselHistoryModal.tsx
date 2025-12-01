"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/utils/trpc";
import { format } from "date-fns";
import {
  Loader2,
  Beaker,
  ArrowRight,
  ArrowLeft,
  Filter,
  Sparkles,
  Droplets,
  FlaskConical,
  PlayCircle,
  CheckCircle,
  Brush,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VesselHistoryModalProps {
  vesselId: string;
  open: boolean;
  onClose: () => void;
}

const activityIcons: Record<string, React.ReactNode> = {
  batch_started: <PlayCircle className="h-4 w-4 text-green-600" />,
  batch_completed: <CheckCircle className="h-4 w-4 text-gray-500" />,
  racking_in: <ArrowLeft className="h-4 w-4 text-blue-600" />,
  racking_out: <ArrowRight className="h-4 w-4 text-orange-600" />,
  transfer_in: <ArrowLeft className="h-4 w-4 text-blue-600" />,
  transfer_out: <ArrowRight className="h-4 w-4 text-orange-600" />,
  filtering: <Filter className="h-4 w-4 text-purple-600" />,
  measurement: <Beaker className="h-4 w-4 text-cyan-600" />,
  additive: <FlaskConical className="h-4 w-4 text-pink-600" />,
  cleaning: <Brush className="h-4 w-4 text-emerald-600" />,
};

const activityColors: Record<string, string> = {
  batch_started: "bg-green-50 border-green-200",
  batch_completed: "bg-gray-50 border-gray-200",
  racking_in: "bg-blue-50 border-blue-200",
  racking_out: "bg-orange-50 border-orange-200",
  transfer_in: "bg-blue-50 border-blue-200",
  transfer_out: "bg-orange-50 border-orange-200",
  filtering: "bg-purple-50 border-purple-200",
  measurement: "bg-cyan-50 border-cyan-200",
  additive: "bg-pink-50 border-pink-200",
  cleaning: "bg-emerald-50 border-emerald-200",
};

export function VesselHistoryModal({ vesselId, open, onClose }: VesselHistoryModalProps) {
  const { data, isLoading, error } = trpc.vessel.getHistory.useQuery(
    { vesselId, limit: 100 },
    { enabled: open && !!vesselId }
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            {data?.vessel?.name || "Tank"} History
          </DialogTitle>
          <DialogDescription className="flex gap-2">
            {data?.vessel ? (
              <>
                <span>{data.vessel.capacity}{data.vessel.capacityUnit || "L"} capacity</span>
                {data.vessel.material && <span>| {data.vessel.material}</span>}
                {data.vessel.location && <span>| {data.vessel.location}</span>}
              </>
            ) : (
              "Loading vessel history..."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[60vh] overflow-y-auto pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              Failed to load history: {error.message}
            </div>
          ) : !data?.activities?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No activity recorded for this vessel yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.activities.map((activity) => (
                <div
                  key={activity.id}
                  className={`p-3 rounded-lg border ${activityColors[activity.type] || "bg-gray-50 border-gray-200"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {activityIcons[activity.type] || <Sparkles className="h-4 w-4 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{activity.description}</p>
                        {activity.volumeChange && (
                          <Badge
                            variant="outline"
                            className={activity.volumeChange.startsWith("+") ? "text-green-700 border-green-300" : "text-orange-700 border-orange-300"}
                          >
                            {activity.volumeChange}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{format(new Date(activity.timestamp), "MMM d, yyyy 'at' h:mm a")}</span>
                        {activity.batchName && (
                          <>
                            <span>|</span>
                            <span className="truncate">{activity.batchName}</span>
                          </>
                        )}
                        {activity.userName && (
                          <>
                            <span>|</span>
                            <span>by {activity.userName}</span>
                          </>
                        )}
                      </div>
                      {activity.notes && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          {activity.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {data.totalCount > data.activities.length && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Showing {data.activities.length} of {data.totalCount} activities
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
