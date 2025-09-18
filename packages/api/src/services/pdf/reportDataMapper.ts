import type { PurchaseOrderData, DateRangeReportData } from './types'

export function mapPurchaseToOrderData(purchase: any): PurchaseOrderData {
  // Calculate totals
  const subtotal = purchase.items?.reduce((sum: number, item: any) => {
    const itemTotal = item.quantity * (item.pricePerUnit || 0)
    return sum + itemTotal
  }, 0) || 0

  const tax = 0 // Can be calculated based on business rules
  const total = subtotal + tax

  return {
    purchaseId: purchase.id,
    purchaseDate: new Date(purchase.purchaseDate),
    vendor: {
      name: purchase.vendor?.name || 'Unknown Vendor',
      contactInfo: {
        email: purchase.vendor?.contactInfo?.email,
        phone: purchase.vendor?.contactInfo?.phone,
        address: purchase.vendor?.contactInfo?.address
      }
    },
    items: purchase.items?.map((item: any) => ({
      varietyName: item.appleVariety?.name || 'Unknown Variety',
      quantity: item.quantity,
      unit: item.unit,
      pricePerUnit: item.pricePerUnit,
      totalPrice: item.quantity * (item.pricePerUnit || 0),
      harvestDate: item.harvestDate ? new Date(item.harvestDate) : undefined
    })) || [],
    totals: {
      subtotal,
      tax,
      total
    },
    notes: purchase.notes
  }
}

export function mapPurchasesToDateRangeData(
  purchases: any[],
  startDate: Date,
  endDate: Date,
  reportType: 'summary' | 'detailed' | 'accounting'
): DateRangeReportData {
  const totalPurchases = purchases.length
  const totalCost = purchases.reduce((sum, purchase) => {
    return sum + (purchase.items?.reduce((itemSum: number, item: any) => {
      return itemSum + (item.quantity * (item.pricePerUnit || 0))
    }, 0) || 0)
  }, 0)

  const averageCost = totalPurchases > 0 ? totalCost / totalPurchases : 0

  // Calculate top vendors
  const vendorStats = new Map<string, { orderCount: number; totalCost: number }>()

  purchases.forEach(purchase => {
    const vendorName = purchase.vendor?.name || 'Unknown Vendor'
    const purchaseCost = purchase.items?.reduce((sum: number, item: any) => {
      return sum + (item.quantity * (item.pricePerUnit || 0))
    }, 0) || 0

    const existing = vendorStats.get(vendorName) || { orderCount: 0, totalCost: 0 }
    vendorStats.set(vendorName, {
      orderCount: existing.orderCount + 1,
      totalCost: existing.totalCost + purchaseCost
    })
  })

  const topVendors = Array.from(vendorStats.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)

  return {
    startDate,
    endDate,
    reportType,
    purchases: purchases.map(purchase => ({
      id: purchase.id,
      date: new Date(purchase.purchaseDate),
      vendorName: purchase.vendor?.name || 'Unknown Vendor',
      items: purchase.items?.map((item: any) => ({
        varietyName: item.appleVariety?.name || 'Unknown Variety',
        quantity: item.quantity,
        unit: item.unit,
        cost: item.quantity * (item.pricePerUnit || 0)
      })) || [],
      totalCost: purchase.items?.reduce((sum: number, item: any) => {
        return sum + (item.quantity * (item.pricePerUnit || 0))
      }, 0) || 0
    })),
    summary: {
      totalPurchases,
      totalCost,
      averageCost,
      topVendors
    }
  }
}