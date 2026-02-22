import dotenv from "dotenv";
import path from "path";

// Load DATABASE_URL from packages/db/.env before any db modules are imported
dotenv.config({ path: path.resolve(__dirname, "../../db/.env") });

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
