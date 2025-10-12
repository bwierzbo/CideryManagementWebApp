// DROPPED: InventoryService extensively uses dropped tables (inventory, inventoryTransactions, packages)
// TODO: Reimplement when proper inventory system is ready

import { TRPCError } from "@trpc/server";

export class InventoryService {
  static async recordTransaction(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }

  static async createInventoryItem(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }

  static async bulkTransfer(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }

  static async checkStockLevels(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }

  static async reserveInventory(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }

  static async releaseReservation(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }

  static async getTransactionSummary(...args: any[]): Promise<any> {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Inventory service temporarily disabled - under reconstruction",
    });
  }
}
