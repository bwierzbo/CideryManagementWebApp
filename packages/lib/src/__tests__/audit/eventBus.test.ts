import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  AuditEventBus,
  auditEventBus,
  publishCreateEvent,
  publishUpdateEvent,
  publishDeleteEvent,
  publishSoftDeleteEvent,
  publishRestoreEvent,
  createDatabaseAuditSubscriber,
} from "../../audit/eventBus";
import type { AuditEvent } from "../../audit/eventBus";

describe("AuditEventBus", () => {
  let eventBus: AuditEventBus;
  let mockHandler: Mock;

  beforeEach(() => {
    eventBus = new AuditEventBus();
    mockHandler = vi.fn();
  });

  describe("subscribe and unsubscribe", () => {
    it("should subscribe to events and return subscription ID", () => {
      const subscriptionId = eventBus.subscribe(mockHandler);

      expect(subscriptionId).toMatch(/^sub_\d+$/);
      expect(eventBus.getSubscriptionCount()).toBe(1);
    });

    it("should unsubscribe from events", () => {
      const subscriptionId = eventBus.subscribe(mockHandler);

      expect(eventBus.getSubscriptionCount()).toBe(1);

      const unsubscribed = eventBus.unsubscribe(subscriptionId);

      expect(unsubscribed).toBe(true);
      expect(eventBus.getSubscriptionCount()).toBe(0);
    });

    it("should return false when unsubscribing non-existent subscription", () => {
      const result = eventBus.unsubscribe("non-existent");
      expect(result).toBe(false);
    });

    it("should support table-specific subscriptions", () => {
      const generalHandler = vi.fn();
      const userHandler = vi.fn();

      eventBus.subscribe(generalHandler);
      eventBus.subscribe(userHandler, "users");

      expect(eventBus.getSubscriptionCount()).toBe(2);
    });
  });

  describe("publish", () => {
    it("should publish events to all subscribers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe(handler1);
      eventBus.subscribe(handler2);

      const event: AuditEvent = {
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe" },
        timestamp: new Date(),
      };

      await eventBus.publish(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should filter events by table name", async () => {
      const generalHandler = vi.fn();
      const userHandler = vi.fn();
      const productHandler = vi.fn();

      eventBus.subscribe(generalHandler);
      eventBus.subscribe(userHandler, "users");
      eventBus.subscribe(productHandler, "products");

      const userEvent: AuditEvent = {
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe" },
        timestamp: new Date(),
      };

      await eventBus.publish(userEvent);

      expect(generalHandler).toHaveBeenCalledWith(userEvent);
      expect(userHandler).toHaveBeenCalledWith(userEvent);
      expect(productHandler).not.toHaveBeenCalled();
    });

    it("should handle async event handlers", async () => {
      const syncHandler = vi.fn();
      const asyncHandler = vi.fn().mockResolvedValue(undefined);

      eventBus.subscribe(syncHandler);
      eventBus.subscribe(asyncHandler);

      const event: AuditEvent = {
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe" },
        timestamp: new Date(),
      };

      await eventBus.publish(event);

      expect(syncHandler).toHaveBeenCalledWith(event);
      expect(asyncHandler).toHaveBeenCalledWith(event);
    });

    it("should handle errors in event handlers gracefully", async () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });
      const workingHandler = vi.fn();

      // Mock console.error to avoid noise in tests
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      eventBus.subscribe(errorHandler);
      eventBus.subscribe(workingHandler);

      const event: AuditEvent = {
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe" },
        timestamp: new Date(),
      };

      // Should not throw
      await expect(eventBus.publish(event)).resolves.toBeUndefined();

      expect(errorHandler).toHaveBeenCalledWith(event);
      expect(workingHandler).toHaveBeenCalledWith(event);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error in audit event handler"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle async handler rejections", async () => {
      const rejectingHandler = vi
        .fn()
        .mockRejectedValue(new Error("Async error"));
      const workingHandler = vi.fn();

      eventBus.subscribe(rejectingHandler);
      eventBus.subscribe(workingHandler);

      const event: AuditEvent = {
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe" },
        timestamp: new Date(),
      };

      // Should not throw
      await expect(eventBus.publish(event)).resolves.toBeUndefined();

      expect(rejectingHandler).toHaveBeenCalledWith(event);
      expect(workingHandler).toHaveBeenCalledWith(event);
    });
  });

  describe("clearAllSubscriptions", () => {
    it("should clear all subscriptions", () => {
      eventBus.subscribe(vi.fn());
      eventBus.subscribe(vi.fn());
      eventBus.subscribe(vi.fn(), "users");

      expect(eventBus.getSubscriptionCount()).toBe(3);

      eventBus.clearAllSubscriptions();

      expect(eventBus.getSubscriptionCount()).toBe(0);
    });
  });
});

describe("Global auditEventBus", () => {
  beforeEach(() => {
    // Clear global event bus before each test
    auditEventBus.clearAllSubscriptions();
  });

  it("should provide a global event bus instance", () => {
    expect(auditEventBus).toBeInstanceOf(AuditEventBus);
  });

  it("should maintain state across calls", () => {
    const handler = vi.fn();
    const subscriptionId = auditEventBus.subscribe(handler);

    expect(auditEventBus.getSubscriptionCount()).toBe(1);

    auditEventBus.unsubscribe(subscriptionId);

    expect(auditEventBus.getSubscriptionCount()).toBe(0);
  });
});

describe("Helper functions", () => {
  beforeEach(() => {
    auditEventBus.clearAllSubscriptions();
  });

  describe("publishCreateEvent", () => {
    it("should publish create event with correct data", async () => {
      const handler = vi.fn();
      auditEventBus.subscribe(handler);

      await publishCreateEvent(
        "users",
        "123",
        { name: "John Doe", email: "john@example.com" },
        "user123",
        "New user registration",
      );

      expect(handler).toHaveBeenCalledWith({
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe", email: "john@example.com" },
        changedBy: "user123",
        reason: "New user registration",
        timestamp: expect.any(Date),
      });
    });

    it("should work without optional parameters", async () => {
      const handler = vi.fn();
      auditEventBus.subscribe(handler);

      await publishCreateEvent("users", "123", { name: "John Doe" });

      expect(handler).toHaveBeenCalledWith({
        tableName: "users",
        recordId: "123",
        operation: "create",
        newData: { name: "John Doe" },
        changedBy: undefined,
        reason: undefined,
        timestamp: expect.any(Date),
      });
    });
  });

  describe("publishUpdateEvent", () => {
    it("should publish update event with old and new data", async () => {
      const handler = vi.fn();
      auditEventBus.subscribe(handler);

      const oldData = { name: "John Doe", email: "john@old.com" };
      const newData = { name: "John Smith", email: "john@new.com" };

      await publishUpdateEvent(
        "users",
        "123",
        oldData,
        newData,
        "user123",
        "Name change",
      );

      expect(handler).toHaveBeenCalledWith({
        tableName: "users",
        recordId: "123",
        operation: "update",
        oldData,
        newData,
        changedBy: "user123",
        reason: "Name change",
        timestamp: expect.any(Date),
      });
    });
  });

  describe("publishDeleteEvent", () => {
    it("should publish delete event with old data", async () => {
      const handler = vi.fn();
      auditEventBus.subscribe(handler);

      const oldData = { name: "John Doe", email: "john@example.com" };

      await publishDeleteEvent(
        "users",
        "123",
        oldData,
        "admin123",
        "User requested deletion",
      );

      expect(handler).toHaveBeenCalledWith({
        tableName: "users",
        recordId: "123",
        operation: "delete",
        oldData,
        changedBy: "admin123",
        reason: "User requested deletion",
        timestamp: expect.any(Date),
      });
    });
  });

  describe("publishSoftDeleteEvent", () => {
    it("should publish soft delete event", async () => {
      const handler = vi.fn();
      auditEventBus.subscribe(handler);

      const oldData = { name: "John Doe", isActive: true };

      await publishSoftDeleteEvent(
        "users",
        "123",
        oldData,
        "admin123",
        "Account deactivation",
      );

      expect(handler).toHaveBeenCalledWith({
        tableName: "users",
        recordId: "123",
        operation: "soft_delete",
        oldData,
        changedBy: "admin123",
        reason: "Account deactivation",
        timestamp: expect.any(Date),
      });
    });
  });

  describe("publishRestoreEvent", () => {
    it("should publish restore event", async () => {
      const handler = vi.fn();
      auditEventBus.subscribe(handler);

      const newData = { name: "John Doe", isActive: true };

      await publishRestoreEvent(
        "users",
        "123",
        newData,
        "admin123",
        "Account reactivation",
      );

      expect(handler).toHaveBeenCalledWith({
        tableName: "users",
        recordId: "123",
        operation: "restore",
        newData,
        changedBy: "admin123",
        reason: "Account reactivation",
        timestamp: expect.any(Date),
      });
    });
  });
});

describe("createDatabaseAuditSubscriber", () => {
  beforeEach(() => {
    auditEventBus.clearAllSubscriptions();
  });

  it("should create database subscriber that writes to database", async () => {
    const mockWriteFunction = vi.fn().mockResolvedValue(undefined);

    const subscriptionId = createDatabaseAuditSubscriber(mockWriteFunction);

    expect(subscriptionId).toMatch(/^sub_\d+$/);
    expect(auditEventBus.getSubscriptionCount()).toBe(1);

    // Publish an event
    const event: AuditEvent = {
      tableName: "users",
      recordId: "123",
      operation: "create",
      newData: { name: "John Doe" },
      changedBy: "user123",
      timestamp: new Date("2024-01-01T10:00:00Z"),
    };

    await auditEventBus.publish(event);

    expect(mockWriteFunction).toHaveBeenCalledWith({
      tableName: "users",
      recordId: "123",
      operation: "create",
      oldData: undefined,
      newData: { name: "John Doe" },
      changedBy: "user123",
      changedAt: new Date("2024-01-01T10:00:00Z"),
      reason: undefined,
    });
  });

  it("should handle database write errors gracefully", async () => {
    const mockWriteFunction = vi
      .fn()
      .mockRejectedValue(new Error("Database error"));

    // Mock console.error to avoid noise in tests
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    createDatabaseAuditSubscriber(mockWriteFunction);

    const event: AuditEvent = {
      tableName: "users",
      recordId: "123",
      operation: "create",
      newData: { name: "John Doe" },
      timestamp: new Date(),
    };

    // Should not throw
    await expect(auditEventBus.publish(event)).resolves.toBeUndefined();

    expect(mockWriteFunction).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to write audit log to database:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
