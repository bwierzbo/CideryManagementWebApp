"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";
import { TTBFormPreview } from "@/components/reports/TTBFormPreview";

// Friendly label for how the period's opening inventory was seeded.
const OPENING_SOURCE_LABELS: Record<string, string> = {
  snapshot: "prior period snapshot",
  ttb_opening_balance: "TTB opening balance",
  calculated: "reconstructed from events",
};

function TTBPrintContent() {
  const searchParams = useSearchParams();

  const periodTypeParam = searchParams.get("periodType");
  const periodType: "monthly" | "quarterly" | "annual" =
    periodTypeParam === "monthly" || periodTypeParam === "annual"
      ? periodTypeParam
      : "quarterly";
  const year = Number(searchParams.get("year")) || new Date().getFullYear();
  const periodNumberRaw = searchParams.get("periodNumber");
  const periodNumber =
    periodType !== "annual" && periodNumberRaw ? Number(periodNumberRaw) : undefined;

  const { data: orgSettings } = trpc.settings.getOrganizationSettings.useQuery();

  const { data: formResult, isLoading: isLoadingForm } =
    trpc.ttb.generateForm512017.useQuery({ periodType, year, periodNumber });

  const { data: filingContext } = trpc.ttb.getPeriodFilingContext.useQuery({
    periodType,
    year,
    periodNumber,
  });

  if (isLoadingForm || !formResult) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-4" />
        <p className="text-gray-500">Preparing printable TTB Form 5120.17…</p>
      </div>
    );
  }

  const { formData, periodLabel } = formResult;

  // Drift alarm — preserved on screen via the badges inside TTBFormPreview; the
  // print output additionally carries a visible DRAFT watermark. Warn, never block.
  const hasNewDrift = formData.filedDrift?.status === "new_drift";

  // Footer basis line.
  const preparedOn = formatDate(new Date());
  const checkpoint = filingContext?.checkpoint ?? null;
  const checkpointBasis = checkpoint
    ? `reconciliation checkpoint '${checkpoint.name || checkpoint.reconciliationDate}' locked ${formatDate(
        checkpoint.finalizedAt ?? checkpoint.reconciliationDate,
      )}`
    : "no checkpoint";
  const openingSourceLabel =
    OPENING_SOURCE_LABELS[formData.openingSource?.source ?? "calculated"] ??
    formData.openingSource?.source ??
    "unknown";

  return (
    <div className="ttb-print-root min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Print toolbar — hidden on the printed page. */}
      <div className="no-print max-w-[1100px] mx-auto mb-4 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            TTB F 5120.17 — {periodLabel}
          </h1>
          <p className="text-sm text-gray-500">
            Print or save as PDF from your browser&apos;s print dialog.
          </p>
        </div>
        <Button onClick={() => window.print()} className="bg-amber-600 hover:bg-amber-700">
          <Printer className="w-4 h-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      {/* On-screen drift banner — hidden in print (the watermark takes over). */}
      {hasNewDrift && (
        <div className="no-print max-w-[1100px] mx-auto mb-4 px-4">
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-300 rounded-lg text-red-800 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              The recompute has drifted from the filed form. The printed copy is
              watermarked DRAFT — recompute drifts from the filed form before
              filing.
            </span>
          </div>
        </div>
      )}

      {/* Draft watermark — display:none on screen, shown on every printed page. */}
      {hasNewDrift && (
        <div className="ttb-print-watermark" aria-hidden="true">
          DRAFT — recompute drifts from the filed form
        </div>
      )}

      <div className="max-w-[1100px] mx-auto px-4 print:px-0 print:max-w-none">
        <TTBFormPreview
          formData={formData}
          periodLabel={periodLabel}
          orgInfo={
            orgSettings
              ? {
                  name: orgSettings.name,
                  address: orgSettings.address,
                  einNumber: orgSettings.einNumber,
                  ttbPermitNumber: orgSettings.ttbPermitNumber,
                }
              : undefined
          }
        />

        {/* Footer: preparation + reconciliation basis + opening source. */}
        <div className="ttb-section text-[10px] text-gray-600 border-x-2 border-b-2 border-gray-600 px-3 py-2 leading-relaxed">
          Prepared {preparedOn} · Basis: {checkpointBasis} · Opening source:{" "}
          {openingSourceLabel}
        </div>
      </div>
    </div>
  );
}

export default function TTBPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      }
    >
      <TTBPrintContent />
    </Suspense>
  );
}
