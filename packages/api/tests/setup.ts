import { vi, beforeAll, afterAll } from "vitest";

// Mock environment variables
beforeAll(() => {
  process.env.NODE_ENV = "test";

  // Mock any global API setup that might be needed
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});
