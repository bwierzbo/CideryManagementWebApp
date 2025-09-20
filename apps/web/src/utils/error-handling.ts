import { toast } from "@/hooks/use-toast"

export interface ErrorDetails {
  message: string
  code?: string
  field?: string
  context?: Record<string, any>
}

export interface UserFriendlyError {
  title: string
  description: string
  variant: "destructive" | "default"
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Enhanced error handling utility for production-ready user feedback
 */
export class ErrorHandler {
  /**
   * Maps common error patterns to user-friendly messages
   */
  private static errorMap: Record<string, UserFriendlyError> = {
    // Network errors
    'ECONNREFUSED': {
      title: 'Connection Error',
      description: 'Unable to connect to the server. Please check your internet connection.',
      variant: 'destructive'
    },
    'NetworkError': {
      title: 'Network Error',
      description: 'A network error occurred. Please try again.',
      variant: 'destructive'
    },
    'TIMEOUT': {
      title: 'Request Timeout',
      description: 'The request took too long to complete. Please try again.',
      variant: 'destructive'
    },

    // Authentication errors
    'UNAUTHORIZED': {
      title: 'Authentication Required',
      description: 'Please log in to continue.',
      variant: 'destructive'
    },
    'FORBIDDEN': {
      title: 'Access Denied',
      description: 'You do not have permission to perform this action.',
      variant: 'destructive'
    },

    // Validation errors
    'VALIDATION_ERROR': {
      title: 'Invalid Data',
      description: 'Please check your input and try again.',
      variant: 'destructive'
    },
    'REQUIRED_FIELD': {
      title: 'Required Field Missing',
      description: 'Please fill in all required fields.',
      variant: 'destructive'
    },

    // Database errors
    'DUPLICATE_ENTRY': {
      title: 'Duplicate Entry',
      description: 'This item already exists in the system.',
      variant: 'destructive'
    },
    'NOT_FOUND': {
      title: 'Item Not Found',
      description: 'The requested item could not be found.',
      variant: 'destructive'
    },

    // Transaction-specific errors
    'INSUFFICIENT_INVENTORY': {
      title: 'Insufficient Inventory',
      description: 'There is not enough inventory available for this transaction.',
      variant: 'destructive'
    },
    'INVALID_QUANTITY': {
      title: 'Invalid Quantity',
      description: 'Please enter a valid quantity.',
      variant: 'destructive'
    },
    'INVALID_DATE': {
      title: 'Invalid Date',
      description: 'Please enter a valid date.',
      variant: 'destructive'
    }
  }

  /**
   * Handle errors with user-friendly notifications
   */
  static handleError(error: any, context?: string): void {
    console.error(`Error in ${context || 'application'}:`, error)

    const userError = this.parseError(error, context)

    toast({
      title: userError.title,
      description: userError.description,
      variant: userError.variant
    })

    // Log to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.logToMonitoring(error, context)
    }
  }

  /**
   * Handle success messages with consistent styling
   */
  static handleSuccess(title: string, description?: string): void {
    toast({
      title,
      description,
      variant: 'default'
    })
  }

  /**
   * Handle transaction-specific errors with enhanced context
   */
  static handleTransactionError(error: any, transactionType: string, action: string): void {
    const context = `${transactionType} ${action}`
    const userError = this.parseError(error, context)

    // Enhanced error message for transactions
    const enhancedDescription = `Failed to ${action.toLowerCase()} ${transactionType.toLowerCase()} transaction. ${userError.description}`

    toast({
      title: userError.title,
      description: enhancedDescription,
      variant: 'destructive'
    })

    console.error(`Transaction error [${context}]:`, error)
  }

  /**
   * Handle form validation errors
   */
  static handleValidationError(errors: Record<string, string[]>, formName?: string): void {
    const errorMessages = Object.entries(errors).map(([field, messages]) =>
      `${field}: ${messages.join(', ')}`
    ).join('\n')

    toast({
      title: 'Form Validation Error',
      description: `Please correct the following errors:\n${errorMessages}`,
      variant: 'destructive'
    })

    console.error(`Validation error in ${formName || 'form'}:`, errors)
  }

  /**
   * Parse error into user-friendly format
   */
  private static parseError(error: any, context?: string): UserFriendlyError {
    let errorCode: string
    let errorMessage: string

    // Extract error information from different error formats
    if (error?.code) {
      errorCode = error.code
    } else if (error?.message) {
      // Try to extract error code from message
      if (error.message.includes('ECONNREFUSED')) {
        errorCode = 'ECONNREFUSED'
      } else if (error.message.includes('timeout')) {
        errorCode = 'TIMEOUT'
      } else if (error.message.includes('unauthorized')) {
        errorCode = 'UNAUTHORIZED'
      } else if (error.message.includes('forbidden')) {
        errorCode = 'FORBIDDEN'
      } else if (error.message.includes('validation')) {
        errorCode = 'VALIDATION_ERROR'
      } else if (error.message.includes('duplicate')) {
        errorCode = 'DUPLICATE_ENTRY'
      } else if (error.message.includes('not found')) {
        errorCode = 'NOT_FOUND'
      } else {
        errorCode = 'UNKNOWN'
      }
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorCode = 'UNKNOWN'
      errorMessage = error
    } else {
      errorCode = 'UNKNOWN'
      errorMessage = 'An unexpected error occurred'
    }

    // Get user-friendly error or create default
    const userError = this.errorMap[errorCode] || {
      title: 'Error',
      description: context
        ? `An error occurred while ${context.toLowerCase()}. Please try again.`
        : 'An unexpected error occurred. Please try again.',
      variant: 'destructive' as const
    }

    return userError
  }

  /**
   * Log errors to monitoring service (placeholder for production)
   */
  private static logToMonitoring(error: any, context?: string): void {
    // In production, integrate with monitoring services like Sentry, LogRocket, etc.
    // For now, just console.error with structured data
    console.error('[MONITORING]', {
      error: {
        message: error?.message || String(error),
        stack: error?.stack,
        code: error?.code
      },
      context,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    })
  }

  /**
   * Show loading state with progress feedback
   */
  static showLoadingToast(message: string): () => void {
    const toastInstance = toast({
      title: 'Processing...',
      description: message,
      variant: 'default'
    })

    return () => toastInstance.dismiss()
  }

  /**
   * Handle network-related errors specifically
   */
  static handleNetworkError(error: any, operation: string): void {
    let title = 'Network Error'
    let description = `Failed to ${operation}. Please check your connection and try again.`

    if (navigator.onLine === false) {
      title = 'No Internet Connection'
      description = 'Please check your internet connection and try again.'
    }

    toast({
      title,
      description,
      variant: 'destructive'
    })

    console.error(`Network error during ${operation}:`, error)
  }

  /**
   * Handle offline scenarios
   */
  static handleOfflineError(operation: string): void {
    toast({
      title: 'Offline Mode',
      description: `Cannot ${operation} while offline. Changes will be saved locally and synced when connection is restored.`,
      variant: 'default'
    })
  }
}

/**
 * Utility functions for common error scenarios
 */

export const handleApiError = (error: any, operation: string) => {
  ErrorHandler.handleError(error, operation)
}

export const handleFormError = (errors: Record<string, string[]>, formName?: string) => {
  ErrorHandler.handleValidationError(errors, formName)
}

export const handleTransactionError = (error: any, type: string, action: string) => {
  ErrorHandler.handleTransactionError(error, type, action)
}

export const showSuccess = (title: string, description?: string) => {
  ErrorHandler.handleSuccess(title, description)
}

export const showLoading = (message: string) => {
  return ErrorHandler.showLoadingToast(message)
}