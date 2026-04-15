"use client";

import React from "react";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { AddBatchAdditiveForm } from "./AddBatchAdditiveForm";

interface TankAdditiveFormProps {
  vesselId: string;
  onClose: () => void;
}

export function TankAdditiveForm({ vesselId, onClose }: TankAdditiveFormProps) {
  const utils = trpc.useUtils();
  const liquidMapQuery = trpc.vessel.liquidMap.useQuery();

  // Find the batch ID for this vessel
  const liquidMapVessel = liquidMapQuery.data?.vessels.find(
    (v: any) => v.vesselId === vesselId,
  );
  const batchId = liquidMapVessel?.batchId;

  const handleSuccess = () => {
    utils.vessel.liquidMap.invalidate();
    utils.batch.getHistory.invalidate({ batchId: batchId! });
    onClose();
  };

  if (!batchId) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No active batch found in this vessel.</p>
          <p className="text-xs mt-2">
            Additives can only be added to vessels with active batches.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AddBatchAdditiveForm
      batchId={batchId}
      onSuccess={handleSuccess}
      onCancel={onClose}
    />
  );
}
