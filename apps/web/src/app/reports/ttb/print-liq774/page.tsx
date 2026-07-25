"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import { formatDate } from "@/utils/date-format";
import { LIQ774Preview } from "@/components/reports/LIQ774Preview";

function LIQ774PrintContent() {
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

  const { data: result, isLoading } = trpc.ttb.generateLIQ774.useQuery({
    periodType,
    year,
    periodNumber,
  });

  const { data: filingContext } = trpc.ttb.getPeriodFilingContext.useQuery({
    periodType,
    year,
    periodNumber,
  });

  if (isLoading || !result) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-4" />
        <p className="text-gray-500">Preparing printable WA LIQ-774…</p>
      </div>
    );
  }

  const { liq774, periodLabel, channelAttribution } = result;

  const preparedOn = formatDate(new Date());
  const checkpoint = filingContext?.checkpoint ?? null;
  const checkpointBasis = checkpoint
    ? `reconciliation checkpoint '${checkpoint.name || checkpoint.reconciliationDate}' locked ${formatDate(
        checkpoint.finalizedAt ?? checkpoint.reconciliationDate,
      )}`
    : "no checkpoint";

  return (
    <div className="ttb-print-root min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Print toolbar — hidden on the printed page. */}
      <div className="no-print max-w-[1100px] mx-auto mb-4 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">WA LIQ-774 — {periodLabel}</h1>
          <p className="text-sm text-gray-500">
            Print or save as PDF from your browser&apos;s print dialog.
          </p>
        </div>
        <Button onClick={() => window.print()} className="bg-amber-600 hover:bg-amber-700">
          <Printer className="w-4 h-4 mr-2" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 print:px-0 print:max-w-none">
        <LIQ774Preview
          data={liq774}
          periodLabel={periodLabel}
          orgInfo={
            orgSettings
              ? {
                  name: orgSettings.name,
                  address: orgSettings.address,
                  stateLicenseNumber: orgSettings.stateLicenseNumber,
                }
              : undefined
          }
          channelAttribution={channelAttribution}
        />

        {/* Footer: preparation + reconciliation basis (checkpoint). */}
        <div className="ttb-section text-[10px] text-gray-600 border-x-2 border-b-2 border-gray-600 px-3 py-2 leading-relaxed">
          Prepared {preparedOn} · Basis: {checkpointBasis}
        </div>
      </div>
    </div>
  );
}

export default function LIQ774PrintPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      }
    >
      <LIQ774PrintContent />
    </Suspense>
  );
}
