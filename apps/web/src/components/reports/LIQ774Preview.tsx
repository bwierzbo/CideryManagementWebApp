"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle } from "lucide-react";
import type { LIQ774Data, LIQ774CategoryValues } from "lib";

// tRPC serializes Dates as strings.
type SerializedLIQ774Data = Omit<LIQ774Data, "reportingPeriod"> & {
  reportingPeriod: Omit<LIQ774Data["reportingPeriod"], "startDate" | "endDate"> & {
    startDate: string | Date;
    endDate: string | Date;
  };
};

interface LIQ774OrgInfo {
  name?: string | null;
  address?: string | null;
  stateLicenseNumber?: string | null;
}

interface LIQ774PreviewProps {
  data: SerializedLIQ774Data;
  periodLabel: string;
  orgInfo?: LIQ774OrgInfo;
  /** Diagnostics from the generator (gallons that couldn't be attributed). */
  channelAttribution?: { distributionsCount: number; uncategorizedGal: number };
}

// ---------------------------------------------------------------------------
// Formatting + shared cell styles (mirrors TTBFormPreview)
// ---------------------------------------------------------------------------

const fmtGal = (v: number) => (v === 0 ? "" : v.toLocaleString("en-US"));
const fmtGalAlways = (v: number) => v.toLocaleString("en-US");
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const cellBase = "border border-gray-400 px-2 py-1 text-xs";
const cellRight = `${cellBase} text-right tabular-nums`;
const cellLeft = `${cellBase} text-left`;
const cellHeader = `${cellBase} text-center font-bold bg-gray-200 text-[10px] leading-tight`;
const cellBoxNo = `${cellBase} text-center w-8 font-semibold`;
const totalRow = "bg-gray-100 font-bold";
const sectionHeader =
  "bg-gray-800 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wide";
const sectionBorder = "ttb-section border-x-2 border-b-2 border-gray-600";

// The three category columns + total.
const CATEGORY_COLUMNS = [
  { key: "cider", label: "CIDER" },
  { key: "nonFortified", label: "NON-FORTIFIED" },
  { key: "fortified", label: "FORTIFIED" },
  { key: "total", label: "TOTAL" },
] as const;

export function LIQ774Preview({
  data,
  periodLabel,
  orgInfo,
  channelAttribution,
}: LIQ774PreviewProps) {
  const boxRows: Array<{
    box: string;
    desc: string;
    values: LIQ774CategoryValues;
    isTotal?: boolean;
  }> = [
    { box: "1", desc: "Total NET gallons handled", values: data.box1_totalNetGallons },
    { box: "2", desc: "Total removed at winery (taxpaid + export)", values: data.box2_totalAtWinery },
    { box: "9", desc: "Total removals", values: data.box9_totalRemovals, isTotal: true },
    { box: "10", desc: "Out-of-state, bond-to-bond (non-taxable)", values: data.box10_outOfState },
    { box: "11", desc: "WA distributors — Form 777 (non-taxable)", values: data.box11_waDistributors },
    { box: "12", desc: "WSLCB / Military / ICC / exports (non-taxable)", values: data.box12_wslcbMilitaryExport },
    { box: "13", desc: "Winery retail (DTC, samples, donations, tasting)", values: data.box13_wineryRetail },
    { box: "14", desc: "WA retail licensees", values: data.box14_waRetailLicensees },
    { box: "15", desc: "Total taxable sales (13 + 14)", values: data.box15_totalTaxable, isTotal: true },
    { box: "16", desc: "Reconciliation (11 + 12 + 15)", values: data.box16_reconciliation, isTotal: true },
  ];

  const identityMatch = data.identity.state === "match";

  return (
    <div className="space-y-0 bg-white max-w-[1100px] mx-auto print:max-w-none">
      {/* ============================================================ */}
      {/* FORM HEADER (WA)                                             */}
      {/* ============================================================ */}
      <div className="ttb-section border-2 border-gray-600 p-4 print:p-2">
        <div className="flex justify-between items-start text-[10px] text-gray-600 mb-1">
          <span>WA LIQ-774</span>
          <span>Washington State Liquor and Cannabis Board</span>
        </div>

        <div className="text-center mb-3">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">
            Washington State Liquor and Cannabis Board
          </p>
          <h1 className="text-base font-bold uppercase tracking-wide mt-1">
            Domestic Winery Summary Tax Report
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t border-gray-400 pt-2">
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">LICENSEE NAME:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 truncate">
              {orgInfo?.name || ""}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">LICENSE NO.:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 truncate font-mono">
              {orgInfo?.stateLicenseNumber || ""}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">ADDRESS:</span>
            <span className="border-b border-gray-300 flex-1 min-w-0 truncate">
              {orgInfo?.address || ""}
            </span>
          </div>
          <div className="flex gap-1">
            <span className="font-semibold text-gray-600 whitespace-nowrap">PERIOD:</span>
            <span className="font-mono">{periodLabel}</span>
            {/* box 16 ≡ box 9 identity — 3-state, never plugged. */}
            {identityMatch ? (
              <span className="ml-auto">
                <Badge variant="default" className="bg-green-600 text-[10px] py-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Box 16 = Box 9
                </Badge>
              </span>
            ) : (
              <span className="ml-auto">
                <Badge
                  variant="outline"
                  className="border-amber-500 bg-amber-50 text-amber-700 text-[10px] py-0"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Box 16 ({fmtGalAlways(data.identity.box16)}) ≠ Box 9 ({fmtGalAlways(data.identity.box9)}):{" "}
                  {data.identity.variance > 0 ? "+" : ""}
                  {fmtGalAlways(data.identity.variance)} gal — review before filing
                </Badge>
              </span>
            )}
          </div>
        </div>

        {/* Attribution diagnostics — warn-only. */}
        {channelAttribution && channelAttribution.uncategorizedGal > 0 && (
          <div className="mt-2 border border-amber-300 bg-amber-50 rounded p-2 text-[10px] text-amber-900 flex gap-1">
            <AlertTriangle className="w-3 h-3 mt-px flex-shrink-0 text-amber-600" />
            <span>
              {fmtGalAlways(channelAttribution.uncategorizedGal)} gal of distributed volume
              ({channelAttribution.distributionsCount} distributions this period) could not be
              attributed to a category/channel and is excluded from the taxable-sales boxes —
              this shortfall is what the Box 16 ≠ Box 9 flag surfaces.
            </span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* BOXES 1–16 — GALLONS BY CATEGORY                            */}
      {/* ============================================================ */}
      <div className={`${sectionBorder} overflow-x-auto`}>
        <div className={sectionHeader}>
          Gallons by Category
          <span className="font-normal ml-2 text-gray-300">(in wine gallons)</span>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 32 }}>BOX</th>
              <th className={cellHeader} style={{ minWidth: 260 }}>DESCRIPTION</th>
              {CATEGORY_COLUMNS.map((col) => (
                <th key={col.key} className={cellHeader} style={{ minWidth: 90 }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boxRows.map((row) => (
              <tr key={row.box} className={row.isTotal ? totalRow : ""}>
                <td className={cellBoxNo}>{row.box}</td>
                <td className={`${cellLeft} ${row.isTotal ? "font-bold" : ""}`}>{row.desc}</td>
                {CATEGORY_COLUMNS.map((col) => (
                  <td key={col.key} className={`${cellRight} ${row.isTotal ? "font-bold" : ""}`}>
                    {fmtGal(row.values[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* TAX COMPUTATION — BOXES 17–24                                */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Tax Computation</div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cellHeader} style={{ width: 40 }}>BOX</th>
              <th className={cellHeader} style={{ minWidth: 180 }}>CATEGORY</th>
              <th className={cellHeader} style={{ width: 120 }}>TAXABLE GALLONS</th>
              <th className={cellHeader} style={{ width: 100 }}>RATE / GAL</th>
              <th className={cellHeader} style={{ width: 120 }}>TAX</th>
            </tr>
          </thead>
          <tbody>
            {data.taxLines.map((line, i) => (
              <tr key={line.category}>
                <td className={cellBoxNo}>{17 + i}</td>
                <td className={`${cellLeft} font-medium`}>{line.label}</td>
                <td className={cellRight}>{fmtGalAlways(line.taxableGallons)}</td>
                <td className={cellRight}>${line.taxRate.toFixed(6)}</td>
                <td className={`${cellRight} font-semibold`}>{fmtCurrency(line.tax)}</td>
              </tr>
            ))}
            <tr className={totalRow}>
              <td className={cellBoxNo}>20</td>
              <td className={`${cellLeft} font-bold`} colSpan={3}>Total wine excise tax</td>
              <td className={`${cellRight} font-bold`}>{fmtCurrency(data.box20_totalWineTax)}</td>
            </tr>
            <tr>
              <td className={cellBoxNo}>21</td>
              <td className={cellLeft} colSpan={3}>Late-filing penalty</td>
              <td className={cellRight}>{fmtCurrency(data.box21_latePenalty)}</td>
            </tr>
            <tr>
              <td className={cellBoxNo}>22</td>
              <td className={cellLeft} colSpan={3}>Mead gallons excluded from commission base</td>
              <td className={cellRight}>{fmtGalAlways(data.box22_meadGallons)}</td>
            </tr>
            <tr>
              <td className={cellBoxNo}>23</td>
              <td className={cellLeft} colSpan={3}>
                WA Wine Commission assessment ($0.08/gal, Non-Fortified + Fortified only)
              </td>
              <td className={cellRight}>{fmtCurrency(data.box23_wineCommission)}</td>
            </tr>
            <tr className={totalRow}>
              <td className={cellBoxNo}>24</td>
              <td className={`${cellLeft} font-bold`} colSpan={3}>TOTAL DUE (20 + 21 + 23)</td>
              <td className={`${cellRight} font-bold text-base`}>{fmtCurrency(data.box24_totalDue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ============================================================ */}
      {/* CERTIFICATION                                                */}
      {/* ============================================================ */}
      <div className={sectionBorder}>
        <div className={sectionHeader}>Certification</div>
        <div className="p-3 text-[10px] text-gray-600 leading-relaxed">
          <p className="italic">
            I certify under penalty of perjury under the laws of the State of Washington that the
            information on this report is true and correct.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
            <div>
              <span className="text-gray-500 text-[10px]">SIGNATURE OF AUTHORIZED PERSON</span>
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

      <div className="text-[9px] text-gray-400 text-center py-1">
        WA LIQ-774 — Generated by CiderPilot
      </div>
    </div>
  );
}
