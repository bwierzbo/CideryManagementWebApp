import { vi, beforeAll, afterAll } from "vitest";

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Mock any worker-specific globals
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});
