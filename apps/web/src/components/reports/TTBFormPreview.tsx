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

// Official TTB F 5120.17 column order:
// (a) Total (wine gallons)
// (b) Table wines not over 16%
// (c) Table wines over 16% to 21%
// (d) Table wines over 21% to 24%
// (e) Artificially carbonated & sparkling wines (combined)
// (f) Hard cider
const TTB_COLUMNS = [
  { key: "total", label: "TOTAL (WINE GALLONS)", letter: "(a)" },
  { key: "wineUnder16", label: "TABLE WINES NOT OVER 16%", letter: "(b)" },
  { key: "wine16To21", label: "TABLE WINES OVER 16% TO 21%", letter: "(c)" },
  { key: "wine21To24", label: "TABLE WINES OVER 21% TO 24%", letter: "(d)" },
  { key: "effervescent", label: "ARTIFICIALLY CARBONATED & SPARKLING", letter: "(e)" },
  { key: "hardCider", label: "HARD CIDER", letter: "(f)" },
] as const;

type BulkField = keyof import("lib").BulkWinesSection;
type BottledField = keyof import("lib").BottledWinesSection;

// Shared cell styles
const cellBase = "border border-gray-400 px-2 py-1 text-xs";
const cellRight = `${cellBase} text-right tabular-nums`;
const cellLeft = `${cellBase} text-left`;
const cellHeader = `${cellBase} text-center font-bold bg-gray-200 text-[10px] leading-tight`;
const cellLineNo = `${cellBase} text-center w-8 font-semibold`;
const totalRow = "bg-gray-100 font-bold";

// Section header bar
const sectionHeader = "bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide";
const sectionBorder = "border-x-2 border-b-2 border-gray-600";
const reservedText = "px-3 py-2 text-xs text-gray-400 italic";

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

  const byClass = formData.bulkWinesByTaxClass || {};
  const byBottledClass = formData.bottledWinesByTaxClass || {};

  // Helper: get bulk value for a column
  const getBulkVal = (col: typeof TTB_COLUMNS[number], field: BulkField): number => {
    if (col.key === "total") return (formData.bulkWines[field] as number) ?? 0;
    if (col.key === "effervescent") {
      return ((byClass["carbonatedWine"]?.[field] as number) ?? 0) +
             ((byClass["sparklingWine"]?.[field] as number) ?? 0);
    }
    return (byClass[col.key]?.[field] as number) ?? 0;
  };

  // Helper: get bottled value for a column
  const getBottledVal = (col: typeof TTB_COLUMNS[number], field: BottledField): number => {
    if (col.key === "total") return (formData.bottledWines[field] as number) ?? 0;
    if (col.key === "effervescent") {
      return ((byBottledClass["carbonatedWine"]?.[field] as number) ?? 0) +
             ((byBottledClass["sparklingWine"]?.[field] as number) ?? 0);
    }
    return (byBottledClass[col.key]?.[field] as number) ?? 0;
  };

  // Official TTB Part I-A: Bulk Wines (32 lines)
  const bulkRows: Array<{ line: number; desc: string; field: BulkField | null; isTotal?: boolean; isEnding?: boolean }> = [
    { line: 1, desc: "ON HAND FIRST OF PERIOD", field: "line1_onHandBeginning", isEnding: true },
    { line: 2, desc: "PRODUCED BY FERMENTATION", field: "line2_produced" },
    { line: 3, desc: "PRODUCED BY SWEETENING", field: "line3_sweetening" },
    { line: 4, desc: "PRODUCED BY ADDITION OF WINE SPIRITS", field: "line4_wineSpirits" },
    { line: 5, desc: "PRODUCED BY BLENDING", field: "line5_blending" },
    { line: 6, desc: "PRODUCED BY AMELIORATION", field: "line6_amelioration" },
    { line: 7, desc: "RECEIVED IN BOND", field: "line7_receivedInBond" },
    { line: 8, desc: "BOTTLED WINE DUMPED TO BULK", field: "line8_dumpedToBulk" },
    { line: 9, desc: "INVENTORY GAINS", field: "line9_inventoryGains" },
    { line: 10, desc: "(Write-in)", field: "line10_writeIn" },
    { line: 11, desc: "", field: null },
    { line: 12, desc: "TOTAL (lines 1 through 11)", field: "line12_total", isTotal: true },
    { line: 13, desc: "BOTTLED", field: "line13_bottled" },
    { line: 14, desc: "REMOVED TAXPAID", field: "line14_removedTaxpaid" },
    { line: 15, desc: "TRANSFERS IN BOND", field: "line15_transfersInBond" },
    { line: 16, desc: "REMOVED FOR DISTILLING MATERIAL", field: "line16_distillingMaterial" },
    { line: 17, desc: "REMOVED TO VINEGAR PLANT", field: "line17_vinegarPlant" },
    { line: 18, desc: "USED FOR SWEETENING", field: "line18_sweetening" },
    { line: 19, desc: "USED FOR ADDITION OF WINE SPIRITS", field: "line19_wineSpirits" },
    { line: 20, desc: "USED FOR BLENDING", field: "line20_blending" },
    { line: 21, desc: "USED FOR AMELIORATION", field: "line21_amelioration" },
    { line: 22, desc: "USED FOR EFFERVESCENT WINE", field: "line22_effervescent" },
    { line: 23, desc: "USED FOR TESTING", field: "line23_testing" },
    { line: 24, desc: "(Write-in)", field: "line24_writeIn1" },
    { line: 25, desc: "(Write-in)", field: "line25_writeIn2" },
    { line: 26, desc: "", field: null },
    { line: 27, desc: "", field: null },
    { line: 28, desc: "", field: null },
    { line: 29, desc: "LOSSES (OTHER THAN INVENTORY)", field: "line29_losses" },
    { line: 30, desc: "INVENTORY LOSSES", field: "line30_inventoryLosses" },
    { line: 31, desc: "ON HAND END OF PERIOD", field: "line31_onHandEnd", isEnding: true },
    { line: 32, desc: "TOTAL (lines 13 through 31)", field: "line32_total", isTotal: true },
  ];

  // Official TTB Part I-B: Bottled Wines (21 lines)
  const bottledRows: Array<{ line: number; desc: string; field: BottledField | null; isTotal?: boolean; isEnding?: boolean }> = [
    { line: 1, desc: "ON HAND FIRST OF PERIOD", field: "line1_onHandBeginning", isEnding: true },
    { line: 2, desc: "BOTTLED", field: "line2_bottled" },
    { line: 3, desc: "RECEIVED IN BOND", field: "line3_receivedInBond" },
    { line: 4, desc: "TAXPAID WINE RETURNED TO BOND", field: "line4_taxpaidReturned" },
    { line: 5, desc: "(Write-in)", field: "line5_writeIn" },
    { line: 6, desc: "", field: null },
    { line: 7, desc: "TOTAL (lines 1 through 6)", field: "line7_total", isTotal: true },
    { line: 8, desc: "REMOVED TAXPAID", field: "line8_removedTaxpaid" },
    { line: 9, desc: "TRANSFERRED IN BOND", field: "line9_transferredInBond" },
    { line: 10, desc: "DUMPED TO BULK", field: "line10_dumpedToBulk" },
    { line: 11, desc: "USED FOR TASTING", field: "line11_tasting" },
    { line: 12, desc: "REMOVED FOR EXPORT", field: "line12_export" },
    { line: 13, desc: "REMOVED FOR FAMILY USE", field: "line13_familyUse" },
    { line: 14, desc: "USED FOR TESTING", field: "line14_testing" },
    { line: 15, desc: "(Write-in)", field: "line15_writeIn" },
    { line: 16, desc: "", field: null },
    { line: 17, desc: "", field: null },
    { line: 18, desc: "BREAKAGE", field: "line18_breakage" },
    { line: 19, desc: "INVENTORY SHORTAGE", field: "line19_inventoryShortage" },
    { line: 20, desc: "ON HAND END OF PERIOD", field: "line20_onHandEnd", isEnding: true },
    { line: 21, desc: "TOTAL (lines 8 through 20)", field: "line21_total", isTotal: true },
  ];

  // Distillery operations data
  const distOps = formData.distilleryOperations;
  const hasDistillery = distOps && (
    distOps.ciderSentToDsp > 0 ||
    distOps.brandyReceived > 0 ||
    distOps.brandyUsedInCider > 0 ||
    (formData.ciderBrandyInventory?.brandy?.total ?? 0) > 0
  );

  // Compute brandy opening from reconciliation: opening = expectedEnding - received + used
  const brandyOpening = formData.ciderBrandyReconciliation
    ? Math.max(0, formData.ciderBrandyReconciliation.brandy.expectedEnding -
        (distOps?.brandyReceived ?? 0) + (distOps?.brandyUsedInCider ?? 0))
    : 0;
  const brandyTotal = brandyOpening + (distOps?.brandyReceived ?? 0);
  const brandyEnding = formData.ciderBrandyReconciliation?.brandy.expectedEnding ?? 0;

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
          <span>TTB F 5120.17 (09/2025)</span>
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
      <div className={`${sectionBorder} overflow-x-auto`}>
        <div className={sectionHeader}>
          Part I — Section A: Bulk Wines
          <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            {/* Column letter row */}
            <tr>
              <th className={cellHeader} rowSpan={2} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} rowSpan={2} style={{ minWidth: 200 }}>DESCRIPTION</th>
              {TTB_COLUMNS.map((col) => (
                <th key={col.key} className={cellHeader} style={{ minWidth: 80 }}>
                  {col.letter}
                </th>
              ))}
            </tr>
            {/* Column description row */}
            <tr>
              {TTB_COLUMNS.map((col) => (
                <th key={col.key} className={`${cellHeader} text-[9px]`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bulkRows.map(({ line, desc, field, isTotal, isEnding }) => (
              <tr key={line} className={isTotal ? totalRow : isEnding ? "bg-blue-50/50" : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                {TTB_COLUMNS.map((col) => (
                  <td key={col.key} className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>
                    {field ? fmt(getBulkVal(col, field)) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART I — SECTION B: BOTTLED WINES                            */}
      {/* ============================================================ */}
      <div className={`${sectionBorder} overflow-x-auto`}>
        <div className={sectionHeader}>
          Part I — Section B: Bottled Wines
          <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} rowSpan={2} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} rowSpan={2} style={{ minWidth: 260 }}>DESCRIPTION</th>
              {TTB_COLUMNS.map((col) => (
                <th key={col.key} className={cellHeader} style={{ minWidth: 80 }}>
                  {col.letter}
                </th>
              ))}
            </tr>
            <tr>
              {TTB_COLUMNS.map((col) => (
                <th key={col.key} className={`${cellHeader} text-[9px]`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bottledRows.map(({ line, desc, field, isTotal, isEnding }) => (
              <tr key={line} className={isTotal ? totalRow : isEnding ? "bg-blue-50/50" : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                {TTB_COLUMNS.map((col) => (
                  <td key={col.key} className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>
                    {field ? fmt(getBottledVal(col, field)) : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART II — RESERVED                                           */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Part II — Reserved</div>
        <div className={reservedText}>Reserved</div>
      </div>

      {/* ============================================================ */}
      {/* PART III — SUMMARY OF DISTILLED SPIRITS                      */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>
          Part III — Summary of Distilled Spirits
          <span className="font-normal ml-2 text-gray-300">(in proof gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
              <th className={cellHeader} style={{ width: 90 }}>(a) WINE SPIRITS 190&deg;+</th>
              <th className={cellHeader} style={{ width: 90 }}>(b) WINE SPIRITS &lt;190&deg;</th>
              <th className={cellHeader} style={{ width: 90 }}>(c) BRANDY 190&deg;+</th>
              <th className={cellHeader} style={{ width: 90 }}>(d) BRANDY &lt;190&deg;</th>
              <th className={cellHeader} style={{ width: 90 }}>(e) BRANDY RESIDUE</th>
              <th className={cellHeader} style={{ width: 90 }}>(f) SPIRITS</th>
              <th className={cellHeader} style={{ width: 70 }}>(g) OTHER</th>
              <th className={cellHeader} style={{ width: 80 }}>(h) TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {[
              { line: 1, desc: "ON HAND FIRST OF PERIOD", val: brandyOpening },
              { line: 2, desc: "RECEIVED FOR FORTIFICATION/WINE TREATMENT", val: distOps?.brandyReceived ?? 0 },
              { line: 3, desc: "RECEIVED FOR OTHER PURPOSES", val: 0 },
              { line: 4, desc: "", val: 0 },
              { line: 5, desc: "TOTAL (lines 1 through 4)", val: brandyTotal, isTotal: true },
              { line: 6, desc: "USED FOR FORTIFICATION", val: distOps?.brandyUsedInCider ?? 0 },
              { line: 7, desc: "USED FOR WINE TREATMENT", val: 0 },
              { line: 8, desc: "REMOVED/TRANSFERRED", val: 0 },
              { line: 9, desc: "LOSSES", val: 0 },
              { line: 10, desc: "ON HAND END OF PERIOD", val: brandyEnding, isEnding: true },
            ].map(({ line, desc, val, isTotal, isEnding }) => (
              <tr key={line} className={isTotal ? totalRow : isEnding ? "bg-blue-50/50" : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                {/* Columns (a)-(c), (e)-(g): empty for cidery */}
                <td className={cellRight} />
                <td className={cellRight} />
                <td className={cellRight} />
                {/* Column (d): Brandy Under 190° — where our apple brandy goes */}
                <td className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>{fmt(val)}</td>
                <td className={cellRight} />
                <td className={cellRight} />
                <td className={cellRight} />
                {/* Column (h): Total */}
                <td className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>{fmt(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART IV — MATERIALS RECEIVED AND USED                        */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>
          Part IV — Materials Received and Used
          <span className="font-normal ml-2 text-gray-300">(in pounds unless noted)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} style={{ minWidth: 160 }}>DESCRIPTION</th>
              <th className={cellHeader} style={{ width: 80 }}>(a) APPLES</th>
              <th className={cellHeader} style={{ width: 80 }}>(b) GRAPES</th>
              <th className={cellHeader} style={{ width: 80 }}>(c) OTHER FRUIT</th>
              <th className={cellHeader} style={{ width: 80 }}>(d) HONEY</th>
              <th className={cellHeader} style={{ width: 80 }}>(e) CONC./JUICE (Std. Gal)</th>
              <th className={cellHeader} style={{ width: 80 }}>(f) SUGAR (Lbs)</th>
              <th className={cellHeader} style={{ width: 80 }}>(g) BRANDY (Pr. Gal)</th>
              <th className={cellHeader} style={{ width: 80 }}>(h) WINE SPIRITS (Pr. Gal)</th>
              <th className={cellHeader} style={{ width: 80 }}>(i) OTHER</th>
            </tr>
          </thead>
          <tbody>
            {[
              { line: 1, desc: "ON HAND FIRST OF PERIOD" },
              {
                line: 2, desc: "RECEIVED",
                apples: formData.materials.applesReceivedLbs,
                otherFruit: formData.materials.otherFruitReceivedLbs,
                honey: formData.materials.honeyReceivedLbs,
                juice: formData.materials.appleJuiceGallons,
                sugar: formData.materials.sugarReceivedLbs,
              },
              {
                line: 3, desc: "TOTAL",
                apples: formData.materials.applesReceivedLbs,
                otherFruit: formData.materials.otherFruitReceivedLbs,
                honey: formData.materials.honeyReceivedLbs,
                juice: formData.materials.appleJuiceGallons,
                sugar: formData.materials.sugarReceivedLbs,
                isTotal: true,
              },
              {
                line: 4, desc: "USED — WINE",
                apples: formData.materials.applesUsedLbs,
                otherFruit: formData.materials.otherFruitUsedLbs,
                honey: formData.materials.honeyUsedLbs,
                sugar: formData.materials.sugarUsedLbs,
              },
              { line: 5, desc: "USED — EFFERVESCENT WINE" },
              { line: 6, desc: "USED — SPECIAL NATURAL WINE" },
              { line: 7, desc: "USED — NONBEVERAGE WINE" },
              { line: 8, desc: "USED — DISTILLING MATERIAL" },
              { line: 9, desc: "USED — OTHER" },
              { line: 10, desc: "ON HAND END OF PERIOD" },
            ].map(({ line, desc, apples, otherFruit, honey, juice, sugar, isTotal }) => (
              <tr key={line} className={isTotal ? totalRow : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                <td className={cellRight}>{fmtLbs(apples ?? 0)}</td>
                <td className={cellRight} />{/* Grapes */}
                <td className={cellRight}>{fmtLbs(otherFruit ?? 0)}</td>
                <td className={cellRight}>{fmtLbs(honey ?? 0)}</td>
                <td className={cellRight}>{juice ? fmt(juice) : ""}</td>
                <td className={cellRight}>{fmtLbs(sugar ?? 0)}</td>
                <td className={cellRight} />{/* Brandy proof gal */}
                <td className={cellRight} />{/* Wine spirits proof gal */}
                <td className={cellRight} />{/* Other */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART V — RESERVED                                            */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Part V — Reserved</div>
        <div className={reservedText}>Reserved</div>
      </div>

      {/* ============================================================ */}
      {/* PART VI — DISTILLING MATERIAL AND VINEGAR STOCK              */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>
          Part VI — Distilling Material and Vinegar Stock
          <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
              <th className={cellHeader} style={{ width: 120 }}>DISTILLING MATERIAL</th>
              <th className={cellHeader} style={{ width: 120 }}>VINEGAR STOCK</th>
            </tr>
          </thead>
          <tbody>
            {[
              { line: 1, desc: "ON HAND FIRST OF PERIOD" },
              { line: 2, desc: "PRODUCED" },
              { line: 3, desc: "RECEIVED" },
              { line: 4, desc: "TOTAL (lines 1 through 3)", isTotal: true },
              { line: 5, desc: "REMOVED FOR DISTILLING", distilling: distOps?.ciderSentToDsp ?? 0 },
              { line: 6, desc: "REMOVED TO VINEGAR PLANT" },
              { line: 7, desc: "REMOVED OTHER" },
              { line: 8, desc: "" },
              { line: 9, desc: "LOSSES" },
              { line: 10, desc: "ON HAND END OF PERIOD" },
              { line: 11, desc: "TOTAL (lines 5 through 10)", isTotal: true, distilling: distOps?.ciderSentToDsp ?? 0 },
            ].map(({ line, desc, isTotal, distilling }) => (
              <tr key={line} className={isTotal ? totalRow : ""}>
                <td className={cellLineNo}>{line}</td>
                <td className={`${cellLeft} ${isTotal ? "font-bold" : ""}`}>{desc}</td>
                <td className={`${cellRight} ${isTotal ? "font-bold" : ""}`}>{fmt(distilling ?? 0)}</td>
                <td className={cellRight} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART VII — WINE IN FERMENTERS END OF PERIOD                  */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Part VII — Wine in Fermenters End of Period</div>

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
      {/* PART VIII — NONBEVERAGE WINES                                 */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Part VIII — Nonbeverage Wines</div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
              <th className={cellHeader} style={{ width: 120 }}>GALLONS</th>
            </tr>
          </thead>
          <tbody>
            {[
              { line: 1, desc: "ON HAND FIRST OF PERIOD" },
              { line: 2, desc: "PRODUCED/RECEIVED" },
              { line: 3, desc: "REMOVED" },
              { line: 4, desc: "ON HAND END OF PERIOD" },
            ].map(({ line, desc }) => (
              <tr key={line}>
                <td className={cellLineNo}>{line}</td>
                <td className={cellLeft}>{desc}</td>
                <td className={cellRight} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART IX — SPECIAL NATURAL WINES                               */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Part IX — Special Natural Wines</div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>LINE</th>
              <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
              <th className={cellHeader} style={{ width: 120 }}>GALLONS</th>
            </tr>
          </thead>
          <tbody>
            {[
              { line: 1, desc: "ON HAND FIRST OF PERIOD" },
              { line: 2, desc: "PRODUCED/RECEIVED" },
              { line: 3, desc: "REMOVED" },
              { line: 4, desc: "ON HAND END OF PERIOD" },
            ].map(({ line, desc }) => (
              <tr key={line}>
                <td className={cellLineNo}>{line}</td>
                <td className={cellLeft}>{desc}</td>
                <td className={cellRight} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* PART X — REMARKS                                              */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Part X — Remarks</div>

        <div className="p-3 space-y-3 text-xs">
          {/* Inventory Reconciliation */}
          <div>
            <p className="font-semibold text-gray-700 uppercase text-[10px] mb-1">Inventory Reconciliation (Wine)</p>
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

          {/* Cider/Brandy Reconciliation */}
          {formData.ciderBrandyReconciliation && hasDistillery && (
            <div>
              <p className="font-semibold text-gray-700 uppercase text-[10px] mb-1">Cider / Brandy Reconciliation</p>
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
            </div>
          )}

          {/* Cider/Brandy Inventory Breakdown */}
          {formData.ciderBrandyInventory && hasDistillery && (
            <div>
              <p className="font-semibold text-gray-700 uppercase text-[10px] mb-1">Inventory Breakdown — End of Period</p>
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
            </div>
          )}

          {/* Brandy Transfer Details */}
          {distOps && distOps.brandyTransfers.length > 0 && (
            <div>
              <p className="font-semibold text-gray-700 uppercase text-[10px] mb-1">Brandy Transfer Details</p>
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
                  {distOps.brandyTransfers.map((t, i) => (
                    <tr key={i}>
                      <td className={cellLeft}>{formatDate(typeof t.transferredAt === "string" ? new Date(t.transferredAt) : t.transferredAt)}</td>
                      <td className={cellLeft}>{t.sourceBatch}</td>
                      <td className={cellLeft}>{t.destinationBatch}</td>
                      <td className={cellRight}>{fmt(t.volumeGallons)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAX COMPUTATION                                              */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Tax Computation</div>

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
      {/* CERTIFICATION                                                */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Certification</div>

        <div className="p-3 text-[10px] text-gray-600 leading-relaxed">
          <p className="italic">
            Under the penalties of perjury, I declare that I have examined this return (including any accompanying
            schedules and statements) and to the best of my knowledge and belief, it is true, correct, and complete.
          </p>
          <div className="grid grid-cols-4 gap-4 mt-3 text-xs">
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
            <div>
              <span className="text-gray-500 text-[10px]">TELEPHONE NUMBER</span>
              <div className="border-b border-gray-400 h-6 mt-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom form reference */}
      <div className="text-[9px] text-gray-400 text-center py-1">
        TTB F 5120.17 (09/2025) — Generated by CideryManagement System
      </div>
    </div>
  );
}
