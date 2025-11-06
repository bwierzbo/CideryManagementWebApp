/**
 * Square API Client
 *
 * Provides authenticated Square API client for inventory and catalog operations
 */

import { SquareClient, SquareEnvironment } from "square";

let squareClient: SquareClient | null = null;

/**
 * Initialize Square client with access token
 * Call this once at app startup or when credentials are configured
 */
export function initializeSquareClient(accessToken: string, environment: "production" | "sandbox" = "production") {
  squareClient = new SquareClient({
    token: accessToken,
    environment: environment === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });

  return squareClient;
}

/**
 * Get the initialized Square client
 * Throws if client hasn't been initialized
 */
export function getSquareClient(): SquareClient {
  if (!squareClient) {
    throw new Error("Square client not initialized. Call initializeSquareClient() first.");
  }
  return squareClient;
}

/**
 * Check if Square client is initialized
 */
export function isSquareClientInitialized(): boolean {
  return squareClient !== null;
}

/**
 * Reset Square client (useful for testing or re-initialization)
 */
export function resetSquareClient() {
  squareClient = null;
}
