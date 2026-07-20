"use client";

import { Suspense } from "react";
import { OnHandReconciliation } from "@/components/reports/OnHandReconciliation";

export default function OnHandReconciliationPage() {
  return (
    <Suspense>
      <OnHandReconciliation />
    </Suspense>
  );
}
