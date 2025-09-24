"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Beaker, Plus, Calendar, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { trpc } from "@/utils/trpc"

interface BatchMergeHistoryProps {
  batchId: string
}

export function BatchMergeHistory({ batchId }: BatchMergeHistoryProps) {
  const { data, isLoading, error } = trpc.batch.getMergeHistory.useQuery({ batchId })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load merge history</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const mergeHistory = data?.mergeHistory || []

  if (mergeHistory.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5" />
          Batch Merge History
        </CardTitle>
        <CardDescription>
          This batch has been merged with juice from other sources
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mergeHistory.map((merge) => (
            <div key={merge.id} className="border-l-2 border-primary/20 pl-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(merge.mergedAt, "MMM dd, yyyy 'at' h:mm a")}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {merge.sourceType === 'press_run' ? 'Press Run' : 'Batch Transfer'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Added {parseFloat(merge.volumeAddedL).toFixed(1)}L
                </span>
              </div>

              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  <span>
                    Volume: {parseFloat(merge.targetVolumeBeforeL).toFixed(1)}L → {parseFloat(merge.targetVolumeAfterL).toFixed(1)}L
                  </span>
                </div>

                {(merge.compositionSnapshot as any)?.varieties && (
                  <div className="pl-5 text-xs text-muted-foreground">
                    Added varieties: {(merge.compositionSnapshot as any).varieties
                      .map((v: any) => `${v.varietyName} (${(v.fraction * 100).toFixed(1)}%)`)
                      .join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}