"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/utils/trpc";
import { formatDateTime, formatDate } from "@/utils/date-format";
import {
  Loader2,
  Wine,
  Calendar,
  Clock,
  Beaker,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BarrelHistoryModalProps {
  vesselId: string;
  open: boolean;
  onClose: () => void;
}

const flavorLevelColors: Record<string, { bg: string; text: string; progress: number }> = {
  high: { bg: "bg-amber-100", text: "text-amber-800", progress: 100 },
  medium: { bg: "bg-yellow-100", text: "text-yellow-800", progress: 66 },
  low: { bg: "bg-orange-100", text: "text-orange-800", progress: 33 },
  neutral: { bg: "bg-gray-100", text: "text-gray-800", progress: 10 },
};

const formatWoodType = (woodType: string | null) => {
  if (!woodType) return "Unknown";
  return woodType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatOriginContents = (contents: string | null) => {
  if (!contents) return "Unknown";
  return contents.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatToastLevel = (toast: string | null) => {
  if (!toast) return "Unknown";
  return toast.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

export function BarrelHistoryModal({ vesselId, open, onClose }: BarrelHistoryModalProps) {
  const vesselQuery = trpc.vessel.getById.useQuery(
    { id: vesselId },
    { enabled: open && !!vesselId }
  );

  const historyQuery = trpc.vessel.getBarrelHistory.useQuery(
    { vesselId },
    { enabled: open && !!vesselId }
  );

  const vessel = vesselQuery.data?.vessel;
  const history = historyQuery.data?.history || [];
  const isLoading = vesselQuery.isLoading || historyQuery.isLoading;
  const error = vesselQuery.error || historyQuery.error;

  const flavorInfo = flavorLevelColors[vessel?.barrelFlavorLevel || "high"];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wine className="h-5 w-5 text-amber-600" />
            {vessel?.name || "Barrel"} - Usage History
          </DialogTitle>
          <DialogDescription>
            {vessel ? (
              <span className="flex flex-wrap gap-2">
                <span>{formatWoodType(vessel.barrelWoodType)}</span>
                {vessel.barrelOriginContents && (
                  <>
                    <span>|</span>
                    <span>Ex-{formatOriginContents(vessel.barrelOriginContents)}</span>
                  </>
                )}
                {vessel.barrelToastLevel && (
                  <>
                    <span>|</span>
                    <span>{formatToastLevel(vessel.barrelToastLevel)} Toast</span>
                  </>
                )}
              </span>
            ) : (
              "Loading barrel details..."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[60vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              Failed to load history: {error.message}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Barrel Stats Card */}
              {vessel && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-medium text-amber-900 mb-3">Barrel Status</h3>

                  {/* Flavor Level Indicator */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-amber-800">Flavor Contribution</span>
                      <Badge className={`${flavorInfo.bg} ${flavorInfo.text} border-0`}>
                        {(vessel.barrelFlavorLevel || "high").toUpperCase()}
                      </Badge>
                    </div>
                    <Progress value={flavorInfo.progress} className="h-2" />
                    <p className="text-xs text-amber-700 mt-1">
                      {vessel.barrelFlavorLevel === "high" && "Strong oak and spirit character"}
                      {vessel.barrelFlavorLevel === "medium" && "Moderate flavor contribution"}
                      {vessel.barrelFlavorLevel === "low" && "Subtle flavors remaining"}
                      {vessel.barrelFlavorLevel === "neutral" && "Minimal to no flavor impact"}
                      {!vessel.barrelFlavorLevel && "Strong oak and spirit character"}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-2xl font-bold text-amber-700">
                        {vessel.barrelUseCount || 0}
                      </div>
                      <div className="text-xs text-amber-600">Uses</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-2xl font-bold text-amber-700">
                        {vessel.barrelYearAcquired || "-"}
                      </div>
                      <div className="text-xs text-amber-600">Year Acquired</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-2xl font-bold text-amber-700">
                        {vessel.barrelAgeYears || 0}
                      </div>
                      <div className="text-xs text-amber-600">Age at Acquisition</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="text-2xl font-bold text-amber-700">
                        {vessel.barrelCost ? `$${parseFloat(vessel.barrelCost).toFixed(0)}` : "-"}
                      </div>
                      <div className="text-xs text-amber-600">Cost</div>
                    </div>
                  </div>

                  {/* Origin Notes */}
                  {vessel.barrelOriginNotes && (
                    <div className="mt-3 text-sm text-amber-800 bg-white rounded p-2">
                      <span className="font-medium">Origin: </span>
                      {vessel.barrelOriginNotes}
                    </div>
                  )}

                  {/* Last Prepared */}
                  {vessel.barrelLastPreparedAt && (
                    <div className="mt-2 text-xs text-amber-700">
                      Last prepared: {formatDate(vessel.barrelLastPreparedAt)}
                    </div>
                  )}

                  {/* Retired Status */}
                  {vessel.barrelRetiredAt && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded p-2">
                      <div className="text-sm font-medium text-red-800">
                        Retired: {formatDate(vessel.barrelRetiredAt)}
                      </div>
                      {vessel.barrelRetiredReason && (
                        <div className="text-xs text-red-700 mt-1">
                          Reason: {vessel.barrelRetiredReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Usage History */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Batch History ({history.length})
                </h3>

                {history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-gray-50 rounded-lg">
                    <Beaker className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No batches have been aged in this barrel yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((usage) => (
                      <div
                        key={usage.id}
                        className="bg-white border rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {usage.batchCustomName || usage.batchName || "Unknown Batch"}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(usage.startedAt)}</span>
                              {usage.endedAt && (
                                <>
                                  <span>→</span>
                                  <span>{formatDate(usage.endedAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {usage.durationDays !== null && (
                              <Badge variant="outline" className="text-xs">
                                {usage.durationDays} days
                              </Badge>
                            )}
                            {usage.flavorLevelAtStart && (
                              <Badge
                                className={`text-xs ${
                                  flavorLevelColors[usage.flavorLevelAtStart]?.bg || "bg-gray-100"
                                } ${
                                  flavorLevelColors[usage.flavorLevelAtStart]?.text || "text-gray-800"
                                } border-0`}
                              >
                                {usage.flavorLevelAtStart}
                              </Badge>
                            )}
                            {!usage.endedAt && (
                              <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>
                        {usage.tastingNotes && (
                          <div className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
                            <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="italic">{usage.tastingNotes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
