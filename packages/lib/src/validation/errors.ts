/**
 * Custom error types for business rule validation failures
 * Provides structured, user-friendly error messages with actionable guidance
 */

export class ValidationError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly details: Record<string, any>;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

export class TransferValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("TRANSFER_VALIDATION_ERROR", message, userMessage, details);
    this.name = "TransferValidationError";
  }
}

export class VolumeValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("VOLUME_VALIDATION_ERROR", message, userMessage, details);
    this.name = "VolumeValidationError";
  }
}

export class QuantityValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("QUANTITY_VALIDATION_ERROR", message, userMessage, details);
    this.name = "QuantityValidationError";
  }
}

export class PackagingValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("PACKAGING_VALIDATION_ERROR", message, userMessage, details);
    this.name = "PackagingValidationError";
  }
}

export class MeasurementValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("MEASUREMENT_VALIDATION_ERROR", message, userMessage, details);
    this.name = "MeasurementValidationError";
  }
}

export class VesselStateValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("VESSEL_STATE_VALIDATION_ERROR", message, userMessage, details);
    this.name = "VesselStateValidationError";
  }
}

export class PermissionValidationError extends ValidationError {
  constructor(
    message: string,
    userMessage: string,
    details: Record<string, any> = {},
  ) {
    super("PERMISSION_VALIDATION_ERROR", message, userMessage, details);
    this.name = "PermissionValidationError";
  }
}

/**
 * Helper function to create standardized validation error responses
 */
export function createValidationError(
  type:
    | "transfer"
    | "volume"
    | "quantity"
    | "packaging"
    | "measurement"
    | "vessel_state"
    | "permission",
  message: string,
  userMessage: string,
  details: Record<string, any> = {},
): ValidationError {
  switch (type) {
    case "transfer":
      return new TransferValidationError(message, userMessage, details);
    case "volume":
      return new VolumeValidationError(message, userMessage, details);
    case "quantity":
      return new QuantityValidationError(message, userMessage, details);
    case "packaging":
      return new PackagingValidationError(message, userMessage, details);
    case "measurement":
      return new MeasurementValidationError(message, userMessage, details);
    case "vessel_state":
      return new VesselStateValidationError(message, userMessage, details);
    case "permission":
      return new PermissionValidationError(message, userMessage, details);
    default:
      return new ValidationError(
        "VALIDATION_ERROR",
        message,
        userMessage,
        details,
      );
  }
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Extract user-friendly error message from any error
 */
export function extractUserMessage(error: unknown): string {
  if (isValidationError(error)) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}
