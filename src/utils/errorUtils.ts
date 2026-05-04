/**
 * Extract a human-readable error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return 'Unknown error';
}

/**
 * Log an error with optional context
 */
export function logError(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  if (context) {
    console.error(`${context}:`, message);
  } else {
    console.error(message);
  }
}
