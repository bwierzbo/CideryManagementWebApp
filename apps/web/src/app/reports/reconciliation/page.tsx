"use client";

import { Suspense } from "react";
import { BatchReconciliation } from "@/components/reports/BatchReconciliation";

export default function ReconciliationPage() {
  return (
    <Suspense>
      <BatchReconciliation />
    </Suspense>
  );
}
