"use client";

import { forwardRef } from "react";
import { DocumentHeader } from "./DocumentHeader";
import { PrintableDocument } from "./PrintableDocument";
import { formatDate } from "@/utils/date-format";

export interface PurchaseReceiptItem {
  id: string;
  varietyName?: string | null;
  fruitVarietyName?: string | null;
  quantity: number | string;
  unit?: string | null;
  notes?: string | null;
  totalCost?: number | string | null;
  pricePerUnit?: number | string | null;
}

export interface PurchaseReceiptData {
  id: string;
  purchaseDate: string | Date;
  vendorName?: string | null;
  vendorId?: string | null;
  totalCost?: string | number | null;
  notes?: string | null;
  items: PurchaseReceiptItem[];
}

interface PurchaseReceiptProps {
  purchase: PurchaseReceiptData;
  materialType?: "basefruit" | "additives" | "juice" | "packaging";
}

/**
 * Printable receipt for apple/fruit purchases
 * Shows vendor what was received with official weights
 */
export const PurchaseReceipt = forwardRef<HTMLDivElement, PurchaseReceiptProps>(
  function PurchaseReceipt({ purchase, materialType = "basefruit" }, ref) {
    const purchaseDate =
      typeof purchase.purchaseDate === "string"
        ? new Date(purchase.purchaseDate)
        : purchase.purchaseDate;

    const formatCurrency = (amount: number | string | null | undefined) => {
      if (amount === null || amount === undefined) return null;
      const numAmount =
        typeof amount === "string" ? parseFloat(amount) : amount;
      if (isNaN(numAmount)) return null;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(numAmount);
    };

    // Calculate total weight/quantity
    const totalQuantity = purchase.items.reduce((sum, item) => {
      const qty =
        typeof item.quantity === "string"
          ? parseFloat(item.quantity)
          : item.quantity;
      return sum + (isNaN(qty) ? 0 : qty);
    }, 0);

    // Get primary unit (most common unit among items)
    const unitCounts = purchase.items.reduce(
      (acc, item) => {
        const unit = item.unit || "lb";
        acc[unit] = (acc[unit] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const primaryUnit =
      Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "lb";

    // Material type labels
    const materialLabels = {
      basefruit: "Fruit",
      additives: "Additives",
      juice: "Juice",
      packaging: "Packaging Materials",
    };

    const getMaterialLabel = () => materialLabels[materialType] || "Materials";

    return (
      <PrintableDocument ref={ref}>
        <DocumentHeader />

        {/* Receipt Title */}
        <div className="text-center mb-6 border-b-2 border-gray-200 pb-4">
          <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
            Receipt of {getMaterialLabel()} Received
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            This is a receipt of goods received, not an invoice
          </p>
        </div>

        {/* Receipt Details Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Receipt Info</h3>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="text-gray-600 py-1 pr-4">Receipt #:</td>
                  <td className="font-medium">{purchase.id.slice(0, 8)}</td>
                </tr>
                <tr>
                  <td className="text-gray-600 py-1 pr-4">Date Received:</td>
                  <td className="font-medium">{formatDate(purchaseDate)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Vendor</h3>
            <p className="font-medium">
              {purchase.vendorName || "Unknown Vendor"}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Items Received</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">
                  {materialType === "basefruit" ? "Variety" : "Item"}
                </th>
                <th className="border border-gray-300 px-3 py-2 text-right text-sm font-semibold text-gray-700">
                  Quantity
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">
                  Condition/Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item, index) => (
                <tr key={item.id || index} className="avoid-page-break">
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    {item.varietyName || item.fruitVarietyName || "Unknown"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-right font-mono">
                    {typeof item.quantity === "number"
                      ? item.quantity.toLocaleString()
                      : item.quantity}{" "}
                    {item.unit || "lb"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-sm text-gray-600">
                    {item.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="border border-gray-300 px-3 py-2 text-sm">
                  Total
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm text-right font-mono">
                  {totalQuantity.toLocaleString()} {primaryUnit}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-sm"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes Section */}
        {purchase.notes && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">
              Additional Notes
            </h3>
            <p className="text-sm text-gray-600 p-3 bg-gray-50 border border-gray-200 rounded">
              {purchase.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-gray-600 mb-4">Received by:</p>
              <div className="border-b border-gray-400 w-48 mb-1"></div>
              <p className="text-xs text-gray-500">Signature</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-4">Date:</p>
              <div className="border-b border-gray-400 w-48 mb-1"></div>
              <p className="text-xs text-gray-500">Date</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-8">
            This receipt confirms the quantities of {getMaterialLabel().toLowerCase()} received as
            listed above. The vendor may use this information to prepare an
            invoice.
          </p>
        </div>
      </PrintableDocument>
    );
  }
);
