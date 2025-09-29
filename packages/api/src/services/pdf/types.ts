// Remove PDFDocument import to avoid client-side bundling issues

export interface PdfGenerationOptions {
  format?: "A4" | "Letter";
  margin?: number;
  fontSize?: number;
  includeTimestamp?: boolean;
}

export interface PurchaseOrderData {
  purchaseId: string;
  purchaseDate: Date;
  vendor: {
    name: string;
    contactInfo?: {
      email?: string;
      phone?: string;
      address?: string;
    };
  };
  items: Array<{
    varietyName: string;
    quantity: number;
    unit: string;
    pricePerUnit?: number;
    totalPrice?: number;
    harvestDate?: Date;
  }>;
  totals: {
    subtotal: number;
    tax?: number;
    total: number;
  };
  notes?: string;
}

export interface DateRangeReportData {
  startDate: Date;
  endDate: Date;
  reportType: "summary" | "detailed" | "accounting";
  purchases: Array<{
    id: string;
    date: Date;
    vendorName: string;
    items: Array<{
      varietyName: string;
      quantity: number;
      unit: string;
      cost: number;
    }>;
    totalCost: number;
  }>;
  summary: {
    totalPurchases: number;
    totalCost: number;
    averageCost: number;
    topVendors: Array<{
      name: string;
      orderCount: number;
      totalCost: number;
    }>;
  };
}

export interface PdfGenerationResult {
  success: boolean;
  buffer?: Buffer;
  filename: string;
  contentType: string;
  error?: string;
}

export class PdfGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "PdfGenerationError";
  }
}
