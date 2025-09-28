/**
 * Simple pub/sub event bus for audit logging
 * All database mutations must publish events through this bus
 * Subscribers can listen for events and write to audit_log table
 */

// Event types that can be published
export type AuditEventType =
  | "create"
  | "update"
  | "delete"
  | "soft_delete"
  | "restore";

// Audit event structure
export interface AuditEvent {
  tableName: string;
  recordId: string;
  operation: AuditEventType;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  changedBy?: string;
  reason?: string;
  timestamp: Date;
}

// Event handler function type
export type EventHandler = (event: AuditEvent) => void | Promise<void>;

// Subscription information
interface Subscription {
  id: string;
  handler: EventHandler;
  tableName?: string; // Optional: filter events by table
}

/**
 * Simple pub/sub event bus for audit events
 * Supports filtering by table name and async event handlers
 */
export class AuditEventBus {
  private subscriptions: Map<string, Subscription> = new Map();
  private nextSubscriptionId = 1;

  /**
   * Subscribe to audit events
   *
   * @param handler - Function to handle audit events
   * @param tableName - Optional: only receive events for specific table
   * @returns Subscription ID for unsubscribing
   */
  subscribe(handler: EventHandler, tableName?: string): string {
    const subscriptionId = `sub_${this.nextSubscriptionId++}`;

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      handler,
      tableName,
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from audit events
   *
   * @param subscriptionId - ID returned from subscribe()
   * @returns boolean indicating if subscription was found and removed
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Publish an audit event to all subscribers
   *
   * @param event - The audit event to publish
   */
  async publish(event: AuditEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Filter by table name if specified
      if (
        subscription.tableName &&
        subscription.tableName !== event.tableName
      ) {
        continue;
      }

      try {
        const result = subscription.handler(event);

        // Handle async handlers
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(
          `Error in audit event handler ${subscription.id}:`,
          error,
        );
      }
    }

    // Wait for all async handlers to complete
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * Get count of active subscriptions
   *
   * @returns Number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clear all subscriptions
   * Useful for cleanup in tests
   */
  clearAllSubscriptions(): void {
    this.subscriptions.clear();
  }
}

// Global event bus instance
export const auditEventBus = new AuditEventBus();

/**
 * Helper function to publish a create event
 *
 * @param tableName - Name of the table
 * @param recordId - ID of the created record
 * @param newData - The created record data
 * @param changedBy - User who performed the action
 * @param reason - Optional reason for the action
 */
export async function publishCreateEvent(
  tableName: string,
  recordId: string,
  newData: Record<string, any>,
  changedBy?: string,
  reason?: string,
): Promise<void> {
  await auditEventBus.publish({
    tableName,
    recordId,
    operation: "create",
    newData,
    changedBy,
    reason,
    timestamp: new Date(),
  });
}

/**
 * Helper function to publish an update event
 *
 * @param tableName - Name of the table
 * @param recordId - ID of the updated record
 * @param oldData - The record data before update
 * @param newData - The record data after update
 * @param changedBy - User who performed the action
 * @param reason - Optional reason for the action
 */
export async function publishUpdateEvent(
  tableName: string,
  recordId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  changedBy?: string,
  reason?: string,
): Promise<void> {
  await auditEventBus.publish({
    tableName,
    recordId,
    operation: "update",
    oldData,
    newData,
    changedBy,
    reason,
    timestamp: new Date(),
  });
}

/**
 * Helper function to publish a delete event
 *
 * @param tableName - Name of the table
 * @param recordId - ID of the deleted record
 * @param oldData - The record data before deletion
 * @param changedBy - User who performed the action
 * @param reason - Optional reason for the action
 */
export async function publishDeleteEvent(
  tableName: string,
  recordId: string,
  oldData: Record<string, any>,
  changedBy?: string,
  reason?: string,
): Promise<void> {
  await auditEventBus.publish({
    tableName,
    recordId,
    operation: "delete",
    oldData,
    changedBy,
    reason,
    timestamp: new Date(),
  });
}

/**
 * Helper function to publish a soft delete event
 *
 * @param tableName - Name of the table
 * @param recordId - ID of the soft deleted record
 * @param oldData - The record data before soft deletion
 * @param changedBy - User who performed the action
 * @param reason - Optional reason for the action
 */
export async function publishSoftDeleteEvent(
  tableName: string,
  recordId: string,
  oldData: Record<string, any>,
  changedBy?: string,
  reason?: string,
): Promise<void> {
  await auditEventBus.publish({
    tableName,
    recordId,
    operation: "soft_delete",
    oldData,
    changedBy,
    reason,
    timestamp: new Date(),
  });
}

/**
 * Helper function to publish a restore event (undo soft delete)
 *
 * @param tableName - Name of the table
 * @param recordId - ID of the restored record
 * @param newData - The record data after restoration
 * @param changedBy - User who performed the action
 * @param reason - Optional reason for the action
 */
export async function publishRestoreEvent(
  tableName: string,
  recordId: string,
  newData: Record<string, any>,
  changedBy?: string,
  reason?: string,
): Promise<void> {
  await auditEventBus.publish({
    tableName,
    recordId,
    operation: "restore",
    newData,
    changedBy,
    reason,
    timestamp: new Date(),
  });
}

/**
 * Decorator function to automatically publish audit events for class methods
 * This can be used to wrap database operation methods
 *
 * @param tableName - Name of the table being operated on
 * @param operation - Type of operation being performed
 */
export function auditAction(tableName: string, operation: AuditEventType) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);

      // Try to extract audit information from method arguments or result
      // This is a simplified example - real implementation would be more sophisticated
      if (result && result.id) {
        await auditEventBus.publish({
          tableName,
          recordId: result.id,
          operation,
          newData: operation === "delete" ? undefined : result,
          oldData: operation === "create" ? undefined : args[1], // Assuming old data might be second arg
          timestamp: new Date(),
        });
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Utility to create a database audit subscriber
 * This subscriber writes audit events to the audit_log table
 *
 * @param writeToDatabase - Function to write audit log entry to database
 * @returns Subscription ID
 */
export function createDatabaseAuditSubscriber(
  writeToDatabase: (auditLogEntry: {
    tableName: string;
    recordId: string;
    operation: string;
    oldData?: Record<string, any>;
    newData?: Record<string, any>;
    changedBy?: string;
    changedAt: Date;
    reason?: string;
  }) => Promise<void>,
): string {
  return auditEventBus.subscribe(async (event: AuditEvent) => {
    try {
      await writeToDatabase({
        tableName: event.tableName,
        recordId: event.recordId,
        operation: event.operation,
        oldData: event.oldData,
        newData: event.newData,
        changedBy: event.changedBy,
        changedAt: event.timestamp,
        reason: event.reason,
      });
    } catch (error) {
      console.error("Failed to write audit log to database:", error);
      // In production, you might want to implement retry logic or fallback storage
    }
  });
}
