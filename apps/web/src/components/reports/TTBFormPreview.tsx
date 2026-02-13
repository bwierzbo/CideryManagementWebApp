"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { formatDate } from "@/utils/date-format";
import type { TTBForm512017Data } from "lib";

// tRPC serializes dates as strings, so we need a serialized version of the type
type SerializedBrandyTransfer = Omit<import("lib").BrandyTransfer, 'transferredAt'> & {
  transferredAt: string | Date;
};

type SerializedDistilleryOperations = Omit<NonNullable<TTBForm512017Data['distilleryOperations']>, 'brandyTransfers'> & {
  brandyTransfers: SerializedBrandyTransfer[];
};

type SerializedTTBForm512017Data = Omit<TTBForm512017Data, 'reportingPeriod' | 'distilleryOperations'> & {
  reportingPeriod: Omit<TTBForm512017Data['reportingPeriod'], 'startDate' | 'endDate'> & {
    startDate: string | Date;
    endDate: string | Date;
  };
  distilleryOperations?: SerializedDistilleryOperations;
};

interface OrgInfo {
  name?: string | null;
  address?: string | null;
  einNumber?: string | null;
  ttbPermitNumber?: string | null;
}

interface TTBFormPreviewProps {
  formData: SerializedTTBForm512017Data;
  periodLabel: string;
  orgInfo?: OrgInfo;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number) => (v === 0 ? "" : v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const fmtAlways = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtCurrency = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
const fmtLbs = (v: number) => (v === 0 ? "" : v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

// Official TTB column order and labels
const TTB_COLUMNS = [
  { key: "wineUnder16", label: "NOT OVER 16%", letter: "(a)" },
  { key: "wine16To21", label: "OVER 16 TO 21%", letter: "(b)" },
  { key: "wine21To24", label: "OVER 21 TO 24%", letter: "(c)" },
  { key: "carbonatedWine", label: "ARTIFICIALLY CARBONATED", letter: "(d)" },
  { key: "sparklingWine", label: "SPARKLING WINE", letter: "(e)" },
  { key: "hardCider", label: "HARD CIDER", letter: "(f)" },
] as const;

type BulkField = keyof NonNullable<TTBForm512017Data["bulkWinesByTaxClass"]>[string];

// Shared cell styles
const cellBase = "border border-gray-400 px-2 py-1 text-xs";
const cellRight = `${cellBase} text-right tabular-nums`;
const cellLeft = `${cellBase} text-left`;
const cellHeader = `${cellBase} text-center font-bold bg-gray-200 text-[10px] leading-tight`;
const cellLineNo = `${cellBase} text-center w-8 font-semibold`;
const totalRow = "bg-gray-100 font-bold";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TTBFormPreview({ formData, periodLabel, orgInfo }: TTBFormPreviewProps) {
  const startDate = typeof formData.reportingPeriod.startDate === "string"
    ? new Date(formData.reportingPeriod.startDate)
    : formData.reportingPeriod.startDate;
  const endDate = typeof formData.reportingPeriod.endDate === "string"
    ? new Date(formData.reportingPeriod.endDate)
    : formData.reportingPeriod.endDate;

  // Determine which columns have data
  const byClass = formData.bulkWinesByTaxClass || {};
  const activeColumns = TTB_COLUMNS.filter(
    (col) => col.key === "hardCider" || (byClass[col.key] && (
      byClass[col.key].line1_onHandFirst !== 0 ||
      byClass[col.key].line2_produced !== 0 ||
      byClass[col.key].line32_totalOnHand !== 0 ||
      byClass[col.key].line17_taxpaid !== 0 ||
      byClass[col.key].line3_otherProduction !== 0
    ))
  );
  const showTotal = activeColumns.length > 1;

  // Bulk wine rows
  const bulkRows: Array<{ line: number; desc: string; field: BulkField; isTotal?: boolean; isEnding?: boolean }> = [
    { line: 1, desc: "ON HAND FIRST OF PERIOD", field: "line1_onHandFirst", isEnding: true },
    { line: 2, desc: "PRODUCED BY FERMENTATION", field: "line2_produced" },
    { line: 3, desc: "PRODUCED BY OTHER PROCESSES", field: "line3_otherProduction" },
    { line: 4, desc: "RECEIVED—BONDED WINE PREMISES", field: "line4_receivedBonded" },
    { line: 5, desc: "RECEIVED—CUSTOMS CUSTODY", field: "line5_receivedCustoms" },
    { line: 6, desc: "RECEIVED—RETURNED AFTER REMOVAL", field: "line6_receivedReturned" },
    { line: 7, desc: "RECEIVED—BY TRANSFER IN BOND", field: "line7_receivedTransfer" },
    { line: 8, desc: "BOTTLED WINE DUMPED TO BULK", field: "line8_dumpedToBulk" },
    { line: 9, desc: "WINE TRANSFERRED—FROM OTHER TAX CLASSES", field: "line9_transferredIn" },
    { line: 10, desc: "WITHDRAWN FROM FERMENTERS", field: "line10_withdrawnFermenters" },
    { line: 11, desc: "TOTAL (lines 1 through 10)", field: "line11_total", isTotal: true },
    { line: 12, desc: "BOTTLED OR PACKED", field: "line12_bottled" },
    { line: 13, desc: "TRANSFERRED—FOR EXPORT", field: "line13_exportTransfer" },
    { line: 14, desc: "TRANSFERRED—TO BONDED WINE PREMISES", field: "line14_bondedTransfer" },
    { line: 15, desc: "TRANSFERRED—TO CUSTOMS BONDED WAREHOUSE", field: "line15_customsTransfer" },
    { line: 16, desc: "TRANSFERRED—TO FOREIGN TRADE ZONE", field: "line16_ftzTransfer" },
    { line: 17, desc: "TAXPAID REMOVALS", field: "line17_taxpaid" },
    { line: 18, desc: "TAX-FREE REMOVALS—FOR USE U.S.", field: "line18_taxFreeUS" },
    { line: 19, desc: "TAX-FREE REMOVALS—FOR EXPORT USE", field: "line19_taxFreeExport" },
    { line: 20, desc: "WINE TRANSFERRED—TO OTHER TAX CLASSES", field: "line20_transferredOut" },
    { line: 21, desc: "USED FOR DISTILLING MATERIAL OR VINEGAR STOCK", field: "line21_distillingMaterial" },
    { line: 22, desc: "WINE SPIRITS ADDED", field: "line22_spiritsAdded" },
    { line: 23, desc: "INVENTORY LOSSES", field: "line23_inventoryLosses" },
    { line: 24, desc: "DESTROYED", field: "line24_destroyed" },
    { line: 25, desc: "RETURNED TO BOND", field: "line25_returnedToBond" },
    { line: 26, desc: "OTHER (describe in remarks)", field: "line26_other" },
    { line: 27, desc: "TOTAL (lines 12 through 26)", field: "line27_total", isTotal: true },
    { line: 28, desc: "ON HAND END—IN FERMENTERS", field: "line28_onHandFermenters", isEnding: true },
    { line: 29, desc: "ON HAND END—FINISHED (not bottled)", field: "line29_onHandFinished", isEnding: true },
    { line: 30, desc: "ON HAND END—UNFINISHED (other)", field: "line30_onHandUnfinished", isEnding: true },
    { line: 31, desc: "IN TRANSIT", field: "line31_inTransit", isEnding: true },
    { line: 32, desc: "TOTAL ON HAND END OF PERIOD (lines 28-31)", field: "line32_totalOnHand", isTotal: true, isEnding: true },
  ];

  // Format month ranges for form header
  const periodFrom = `${(startDate.getMonth() + 1).toString().padStart(2, "0")}/${startDate.getFullYear()}`;
  const periodTo = `${(endDate.getMonth() + 1).toString().padStart(2, "0")}/${endDate.getFullYear()}`;

  return (
    <div className="space-y-0 bg-white max-w-[1100px] mx-auto print:max-w-none">
      {/* ============================================================ */}
      {/* FORM HEADER                                                  */}
      {/* ============================================================ */}
      <div className="border-2 border-gray-600 p-4 print:p-2">
        {/* Top line: form number + OMB */}
        <div className="flex justify-between items-start text-[10px] text-gray-600 mb-1">
          <span>TTB F 5120.17 (01/2018)</span>
          <span>OMB No. 1513-0053</span>
        </div>

        {/* Department header */}
        <div className="text-center mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">
            Department of the Treasury — Alcohol and Tobacco Tax and Trade Bureau
          </p>
          <h1 className="text-base font-bold uppercase tracking-wide mt-1">
            Report of Wine Premises Operations
          </h1>
        </div>

        {/* Registrant info grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t border-gray-400 pt-2">
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">1. REGISTRANT&apos;S NAME:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 truncate">
              {orgInfo?.name || ""}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">2. REGISTRY NO.:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 truncate font-mono">
              {orgInfo?.ttbPermitNumber || ""}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">3. ADDRESS:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 truncate">
              {orgInfo?.address || ""}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">4. EIN:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 font-mono">
              {orgInfo?.einNumber || ""}
            </span>
          </div>
          <div className="flex gap-1 col-span-2">
            <span className="font-semibold text-gray-600 whitespace-nowrap">5. FOR PERIOD:</span>
            <span className="font-mono">{periodFrom}</span>
            <span className="text-gray-500">through</span>
            <span className="font-mono">{periodTo}</span>
            <span className="ml-4 text-gray-500">({periodLabel})</span>
            {/* Balance badge */}
            <span className="ml-auto">
              {formData.reconciliation.balanced ? (
                <Badge variant="default" className="bg-green-600 text-[10px] py-0">
                  <CheckCircle className="w-3 h-3 mr-1" />Balanced
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] py-0">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Variance: {fmtAlways(formData.reconciliation.variance)} gal
                </Badge>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* PART I — SECTION A: BULK WINES                               */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600 overflow-x-auto">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Part I — Section A: Bulk Wines
          <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            {/* Column letter row */}
            <tr>
              <th className={cellHeader} rowSpan={2} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} rowSpan={2} style={{ minWidth: 200 }}>DESCRIPTION</th>
              {activeColumns.map((col) => (
                <th key={col.key} className={cellHeader} style={{ minWidth: 80 }}>
                  {col.letter}
                </th>
              ))}
              {showTotal && <th className={cellHeader} style={{ minWidth: 80 }}>(g)</th>}
            </tr>
            {/* Column description row */}
            <tr>
              {activeColumns.map((col) => (
                <th key={col.key} className={`${cellHeader} text-[9px]`}>
                  {col.label}
                </th>
              ))}
              {showTotal && <th className={`${cellHeader} text-[9px]`}>TOTAL</th>}
            </tr>
          </thead>
          <tbody>
            {bulkRows.map(({ line, desc, field, isTotal, isEnding }) => (
              <tr key={line} className={isTotal ? totalRow : isEnding ? "bg-blue-50/50" : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                {activeColumns.map((col) => (
                  <td key={col.key} className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>
                    {fmt(byClass[col.key]?.[field] as number ?? 0)}
                  </td>
                ))}
                {showTotal && (
                  <td className={`${cellRight} font-semibold`}>
                    {fmt(formData.bulkWines[field] as number)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART I — SECTION B: BOTTLED WINES                            */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600 overflow-x-auto">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Part I — Section B: Bottled Wines
          <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
              {activeColumns.map((col) => (
                <th key={col.key} className={cellHeader} style={{ minWidth: 80 }}>
                  {col.letter}<br /><span className="text-[9px] font-normal">{col.label}</span>
                </th>
              ))}
              {showTotal && (
                <th className={cellHeader} style={{ minWidth: 80 }}>(g)<br /><span className="text-[9px] font-normal">TOTAL</span></th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* For now, bottled wines only has hard cider data — show in the (f) column, blank for others */}
            {([
              { line: 1, desc: "ON HAND FIRST OF PERIOD", val: formData.bottledWines.line1_onHandFirst, isEnding: true },
              { line: 2, desc: "BOTTLED OR PACKED (from bulk)", val: formData.bottledWines.line2_bottled },
              { line: 3, desc: "RECEIVED—BONDED WINE PREMISES", val: formData.bottledWines.line3_receivedBonded },
              { line: 4, desc: "RECEIVED—CUSTOMS CUSTODY", val: formData.bottledWines.line4_receivedCustoms },
              { line: 5, desc: "RECEIVED—RETURNED AFTER REMOVAL", val: formData.bottledWines.line5_receivedReturned },
              { line: 6, desc: "RECEIVED—BY TRANSFER IN BOND", val: formData.bottledWines.line6_receivedTransfer },
              { line: 7, desc: "TOTAL (lines 1 through 6)", val: formData.bottledWines.line7_total, isTotal: true },
              { line: 8, desc: "DUMPED TO BULK", val: formData.bottledWines.line8_dumpedToBulk },
              { line: 9, desc: "TRANSFERRED—FOR EXPORT", val: formData.bottledWines.line9_exportTransfer },
              { line: 10, desc: "TRANSFERRED—TO BONDED WINE PREMISES", val: formData.bottledWines.line10_bondedTransfer },
              { line: 11, desc: "TRANSFERRED—TO CUSTOMS BONDED WAREHOUSE", val: formData.bottledWines.line11_customsTransfer },
              { line: 12, desc: "TRANSFERRED—TO FOREIGN TRADE ZONE", val: formData.bottledWines.line12_ftzTransfer },
              { line: 13, desc: "TAXPAID REMOVALS", val: formData.bottledWines.line13_taxpaid },
              { line: 14, desc: "TAX-FREE REMOVALS—FOR USE U.S.", val: formData.bottledWines.line14_taxFreeUS },
              { line: 15, desc: "TAX-FREE REMOVALS—FOR EXPORT USE", val: formData.bottledWines.line15_taxFreeExport },
              { line: 16, desc: "INVENTORY LOSSES OR SHORTAGES", val: formData.bottledWines.line16_inventoryLosses },
              { line: 17, desc: "DESTROYED", val: formData.bottledWines.line17_destroyed },
              { line: 18, desc: "RETURNED TO BOND", val: formData.bottledWines.line18_returnedToBond },
              { line: 19, desc: "TOTAL (lines 8 through 18)", val: formData.bottledWines.line19_total, isTotal: true },
              { line: 20, desc: "ON HAND END OF PERIOD", val: formData.bottledWines.line20_onHandEnd, isEnding: true },
              { line: 21, desc: "IN TRANSIT", val: formData.bottledWines.line21_inTransit },
            ] as Array<{ line: number; desc: string; val: number; isTotal?: boolean; isEnding?: boolean }>).map(({ line, desc, val, isTotal, isEnding }) => (
              <tr key={line} className={isTotal ? totalRow : isEnding ? "bg-blue-50/50" : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                {activeColumns.map((col) => (
                  <td key={col.key} className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>
                    {col.key === "hardCider" ? fmt(val) : ""}
                  </td>
                ))}
                {showTotal && (
                  <td className={`${cellRight} font-semibold`}>{fmt(val)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART II — SPIRITS                                            */}
      {/* ============================================================ */}
      {formData.distilleryOperations && (
        formData.distilleryOperations.ciderSentToDsp > 0 ||
        formData.distilleryOperations.brandyReceived > 0 ||
        formData.distilleryOperations.brandyUsedInCider > 0 ||
        (formData.ciderBrandyInventory?.brandy?.total ?? 0) > 0
      ) && (
        <div className="border-x-2 border-b-2 border-gray-600">
          <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
            Part II — Spirits
            <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
          </div>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={cellHeader} style={{ width: 32 }}>LINE</th>
                <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
                <th className={cellHeader} style={{ width: 100 }}>GALLONS</th>
                <th className={cellHeader} style={{ width: 80 }}>COUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={cellLineNo}>1</td>
                <td className={cellLeft}>CIDER SENT TO DISTILLERY (DSP)</td>
                <td className={cellRight}>{fmt(formData.distilleryOperations.ciderSentToDsp)}</td>
                <td className={`${cellRight} text-gray-500`}>{formData.distilleryOperations.ciderSentShipments || ""}</td>
              </tr>
              <tr>
                <td className={cellLineNo}>2</td>
                <td className={cellLeft}>BRANDY RECEIVED FROM DSP</td>
                <td className={cellRight}>{fmt(formData.distilleryOperations.brandyReceived)}</td>
                <td className={`${cellRight} text-gray-500`}>{formData.distilleryOperations.brandyReceivedReturns || ""}</td>
              </tr>
              <tr>
                <td className={cellLineNo}>3</td>
                <td className={cellLeft}>BRANDY USED IN CIDER PRODUCTION (FORTIFICATION)</td>
                <td className={cellRight}>{fmt(formData.distilleryOperations.brandyUsedInCider)}</td>
                <td className={cellRight} />
              </tr>
            </tbody>
          </table>

          {/* Cider/Brandy Inventory Breakdown */}
          {formData.ciderBrandyInventory && (
            <>
              <div className="bg-gray-200 text-xs font-semibold px-3 py-1 uppercase border-t border-gray-400">
                Inventory Breakdown — End of Period
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={cellHeader} style={{ minWidth: 200 }}>CATEGORY</th>
                    <th className={cellHeader} style={{ width: 100 }}>BULK</th>
                    <th className={cellHeader} style={{ width: 100 }}>BOTTLED/KEGS</th>
                    <th className={cellHeader} style={{ width: 100 }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`${cellLeft} font-medium`}>Cider</td>
                    <td className={cellRight}>{fmt(formData.ciderBrandyInventory.cider.bulk)}</td>
                    <td className={cellRight}>{fmt(formData.ciderBrandyInventory.cider.bottled + formData.ciderBrandyInventory.cider.kegs)}</td>
                    <td className={`${cellRight} font-semibold`}>{fmt(formData.ciderBrandyInventory.cider.total)}</td>
                  </tr>
                  <tr>
                    <td className={`${cellLeft} font-medium`}>Brandy (Apple)</td>
                    <td className={cellRight}>{fmt(formData.ciderBrandyInventory.brandy.bulk)}</td>
                    <td className={cellRight} />
                    <td className={`${cellRight} font-semibold`}>{fmt(formData.ciderBrandyInventory.brandy.total)}</td>
                  </tr>
                  <tr className={totalRow}>
                    <td className={`${cellLeft} font-bold`}>TOTAL</td>
                    <td className={cellRight} />
                    <td className={cellRight} />
                    <td className={`${cellRight} font-bold`}>{fmt(formData.ciderBrandyInventory.total)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Cider/Brandy Reconciliation */}
          {formData.ciderBrandyReconciliation && (
            <>
              <div className="bg-gray-200 text-xs font-semibold px-3 py-1 uppercase border-t border-gray-400">
                Cider / Brandy Reconciliation
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={cellHeader} style={{ minWidth: 200 }}>CATEGORY</th>
                    <th className={cellHeader} style={{ width: 100 }}>EXPECTED</th>
                    <th className={cellHeader} style={{ width: 100 }}>ACTUAL</th>
                    <th className={cellHeader} style={{ width: 100 }}>DISCREPANCY</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`${cellLeft} font-medium`}>Cider</td>
                    <td className={cellRight}>{fmtAlways(formData.ciderBrandyReconciliation.cider.expectedEnding)}</td>
                    <td className={cellRight}>{fmtAlways(formData.ciderBrandyReconciliation.cider.actualEnding)}</td>
                    <td className={`${cellRight} ${formData.ciderBrandyReconciliation.cider.discrepancy !== 0 ? "text-red-600 font-semibold" : "text-green-700"}`}>
                      {fmtAlways(formData.ciderBrandyReconciliation.cider.discrepancy)}
                    </td>
                  </tr>
                  <tr>
                    <td className={`${cellLeft} font-medium`}>Brandy</td>
                    <td className={cellRight}>{fmtAlways(formData.ciderBrandyReconciliation.brandy.expectedEnding)}</td>
                    <td className={cellRight}>{fmtAlways(formData.ciderBrandyReconciliation.brandy.actualEnding)}</td>
                    <td className={`${cellRight} ${formData.ciderBrandyReconciliation.brandy.discrepancy !== 0 ? "text-red-600 font-semibold" : "text-green-700"}`}>
                      {fmtAlways(formData.ciderBrandyReconciliation.brandy.discrepancy)}
                    </td>
                  </tr>
                  <tr className={totalRow}>
                    <td className={`${cellLeft} font-bold`}>TOTAL</td>
                    <td className={`${cellRight} font-bold`}>{fmtAlways(formData.ciderBrandyReconciliation.total.expectedEnding)}</td>
                    <td className={`${cellRight} font-bold`}>{fmtAlways(formData.ciderBrandyReconciliation.total.actualEnding)}</td>
                    <td className={`${cellRight} font-bold ${formData.ciderBrandyReconciliation.total.discrepancy !== 0 ? "text-red-600" : "text-green-700"}`}>
                      {fmtAlways(formData.ciderBrandyReconciliation.total.discrepancy)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Brandy Transfer Details */}
          {formData.distilleryOperations.brandyTransfers.length > 0 && (
            <>
              <div className="bg-gray-200 text-xs font-semibold px-3 py-1 uppercase border-t border-gray-400">
                Brandy Transfer Details
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={cellHeader}>DATE</th>
                    <th className={cellHeader}>SOURCE BATCH</th>
                    <th className={cellHeader}>DESTINATION BATCH</th>
                    <th className={cellHeader} style={{ width: 100 }}>GALLONS</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.distilleryOperations.brandyTransfers.map((t, i) => (
                    <tr key={i}>
                      <td className={cellLeft}>{formatDate(typeof t.transferredAt === "string" ? new Date(t.transferredAt) : t.transferredAt)}</td>
                      <td className={cellLeft}>{t.sourceBatch}</td>
                      <td className={cellLeft}>{t.destinationBatch}</td>
                      <td className={cellRight}>{fmt(t.volumeGallons)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* PART IV — MATERIALS RECEIVED AND USED                        */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Part IV — Materials Received and Used
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ minWidth: 200 }}>MATERIAL</th>
              <th className={cellHeader} style={{ width: 120 }}>RECEIVED</th>
              <th className={cellHeader} style={{ width: 120 }}>USED</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cellLeft}>Apples (pounds)</td>
              <td className={cellRight}>{fmtLbs(formData.materials.applesReceivedLbs)}</td>
              <td className={cellRight}>{fmtLbs(formData.materials.applesUsedLbs)}</td>
            </tr>
            <tr className="bg-blue-50/50">
              <td className={`${cellLeft} pl-6 text-gray-600 italic`}>Juice produced (gallons)</td>
              <td className={cellRight} colSpan={2}>{fmt(formData.materials.appleJuiceGallons)}</td>
            </tr>
            <tr>
              <td className={cellLeft}>Other fruit/berries (pounds)</td>
              <td className={cellRight}>{fmtLbs(formData.materials.otherFruitReceivedLbs)}</td>
              <td className={cellRight}>{fmtLbs(formData.materials.otherFruitUsedLbs)}</td>
            </tr>
            <tr>
              <td className={cellLeft}>Sugar (pounds)</td>
              <td className={cellRight}>{fmtLbs(formData.materials.sugarReceivedLbs)}</td>
              <td className={cellRight}>{fmtLbs(formData.materials.sugarUsedLbs)}</td>
            </tr>
            <tr>
              <td className={cellLeft}>Honey (pounds)</td>
              <td className={cellRight}>{fmtLbs(formData.materials.honeyReceivedLbs)}</td>
              <td className={cellRight}>{fmtLbs(formData.materials.honeyUsedLbs)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART VII — WINE IN FERMENTERS END OF PERIOD                  */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Part VII — Wine in Fermenters End of Period
        </div>

        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className={`${cellLeft} font-semibold`}>Gallons of wine in fermenters</td>
              <td className={`${cellRight} w-32 font-bold text-sm`}>
                {fmtAlways(formData.fermenters.gallonsInFermenters)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* TAX COMPUTATION                                              */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Tax Computation
        </div>

        {formData.taxComputationByClass && formData.taxComputationByClass.length > 0 ? (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={cellHeader} style={{ minWidth: 180 }}>TAX CLASS</th>
                <th className={cellHeader} style={{ width: 100 }}>TAXABLE GALLONS</th>
                <th className={cellHeader} style={{ width: 90 }}>TAX RATE</th>
                <th className={cellHeader} style={{ width: 100 }}>GROSS TAX</th>
                <th className={cellHeader} style={{ width: 100 }}>CREDIT</th>
                <th className={cellHeader} style={{ width: 100 }}>NET TAX</th>
              </tr>
            </thead>
            <tbody>
              {formData.taxComputationByClass.map((cls) => (
                <tr key={cls.taxClass}>
                  <td className={`${cellLeft} font-medium`}>{cls.label}</td>
                  <td className={cellRight}>{fmtAlways(cls.taxableGallons)}</td>
                  <td className={cellRight}>${cls.taxRate.toFixed(3)}</td>
                  <td className={cellRight}>{fmtCurrency(cls.grossTax)}</td>
                  <td className={`${cellRight} text-green-700`}>
                    {cls.smallProducerCredit > 0 ? `-${fmtCurrency(cls.smallProducerCredit)}` : ""}
                  </td>
                  <td className={`${cellRight} font-semibold`}>{fmtCurrency(cls.netTax)}</td>
                </tr>
              ))}
              <tr className={totalRow}>
                <td className={`${cellLeft} font-bold`} colSpan={3}>TOTAL TAX</td>
                <td className={`${cellRight} font-bold`}>
                  {fmtCurrency(formData.taxComputationByClass.reduce((s, c) => s + c.grossTax, 0))}
                </td>
                <td className={`${cellRight} font-bold text-green-700`}>
                  {(() => {
                    const totalCredit = formData.taxComputationByClass.reduce((s, c) => s + c.smallProducerCredit, 0);
                    return totalCredit > 0 ? `-${fmtCurrency(totalCredit)}` : "";
                  })()}
                </td>
                <td className={`${cellRight} font-bold text-base`}>
                  {fmtCurrency(formData.taxComputationByClass.reduce((s, c) => s + c.netTax, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr>
                <td className={cellLeft}>Taxable Gallons</td>
                <td className={`${cellRight} w-32`}>{fmtAlways(formData.taxSummary.taxableGallons)}</td>
              </tr>
              <tr>
                <td className={cellLeft}>Tax Rate (Hard Cider)</td>
                <td className={cellRight}>$0.226 / gal</td>
              </tr>
              <tr>
                <td className={cellLeft}>Gross Tax</td>
                <td className={cellRight}>{fmtCurrency(formData.taxSummary.grossTax)}</td>
              </tr>
              <tr>
                <td className={cellLeft}>Small Producer Credit ({fmtAlways(formData.taxSummary.creditEligibleGallons)} gal @ $0.056)</td>
                <td className={`${cellRight} text-green-700`}>-{fmtCurrency(formData.taxSummary.smallProducerCredit)}</td>
              </tr>
              <tr className={totalRow}>
                <td className={`${cellLeft} font-bold`}>NET TAX OWED</td>
                <td className={`${cellRight} font-bold text-base`}>{fmtCurrency(formData.taxSummary.netTaxOwed)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ============================================================ */}
      {/* INVENTORY RECONCILIATION                                     */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Inventory Reconciliation
        </div>

        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className={`${cellLeft} font-medium`}>Total Available (Beginning + Production + Receipts)</td>
              <td className={`${cellRight} w-32 font-semibold`}>{fmtAlways(formData.reconciliation.totalAvailable)}</td>
            </tr>
            <tr>
              <td className={`${cellLeft} font-medium`}>Total Accounted For (Removals + Ending Inventory)</td>
              <td className={`${cellRight} w-32 font-semibold`}>{fmtAlways(formData.reconciliation.totalAccountedFor)}</td>
            </tr>
            <tr className={formData.reconciliation.balanced ? "bg-green-50" : "bg-red-50"}>
              <td className={`${cellLeft} font-bold`}>
                VARIANCE
                {formData.reconciliation.balanced && (
                  <span className="ml-2 text-green-700 font-normal">(Books balance)</span>
                )}
              </td>
              <td className={`${cellRight} w-32 font-bold ${formData.reconciliation.balanced ? "text-green-700" : "text-red-700"}`}>
                {fmtAlways(formData.reconciliation.variance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* CERTIFICATION (informational)                                */}
      {/* ============================================================ */}
      <div className="border-x-2 border-b-2 border-gray-600">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide">
          Certification
        </div>

        <div className="p-3 text-[10px] text-gray-600 leading-relaxed">
          <p className="italic">
            Under the penalties of perjury, I declare that I have examined this return (including any accompanying
            schedules and statements) and to the best of my knowledge and belief, it is true, correct, and complete.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
            <div>
              <span className="text-gray-500 text-[10px]">SIGNATURE OF PROPRIETOR OR AUTHORIZED PERSON</span>
              <div className="border-b border-gray-400 h-6 mt-1" />
            </div>
            <div>
              <span className="text-gray-500 text-[10px]">PRINTED NAME AND TITLE</span>
              <div className="border-b border-gray-400 h-6 mt-1" />
            </div>
            <div>
              <span className="text-gray-500 text-[10px]">DATE</span>
              <div className="border-b border-gray-400 h-6 mt-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom form reference */}
      <div className="text-[9px] text-gray-400 text-center py-1">
        TTB F 5120.17 (01/2018) — Generated by CideryManagement System
      </div>
    </div>
  );
}
