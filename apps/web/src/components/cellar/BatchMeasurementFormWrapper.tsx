"use client";

import React from "react";
import { trpc } from "@/utils/trpc";
import { AddBatchMeasurementForm } from "./AddBatchMeasurementForm";

interface BatchMeasurementFormWrapperProps {
  vesselId: string;
  batchId: string;
  onClose: () => void;
}

export function BatchMeasurementFormWrapper({
  vesselId,
  batchId,
  onClose,
}: BatchMeasurementFormWrapperProps) {
  const utils = trpc.useUtils();

  const handleSuccess = () => {
    utils.vessel.liquidMap.invalidate();
    utils.batch.get.invalidate({ batchId });
    utils.batch.list.invalidate();
    onClose();
  };

  return (
    <AddBatchMeasurementForm
      batchId={batchId}
      onSuccess={handleSuccess}
      onCancel={onClose}
    />
  );
}
