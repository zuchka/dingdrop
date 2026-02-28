/**
 * Error categories for notification failures
 */
export type NotificationErrorCategory = 
  | 'NETWORK'
  | 'TIMEOUT'
  | 'AUTH'
  | 'INVALID_CONFIG'
  | 'DECRYPTION'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'UNKNOWN';

/**
 * Patterns that might contain secrets - these will be redacted
 */
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /token["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi,
  /api[_-]?key["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi,
  /secret["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi,
  /password["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi,
  /authorization["\s:=]+[A-Za-z0-9\-._~+/]+=*/gi,
  // Webhook URLs in error messages
  /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9\/]+/gi,
  /https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9\-_]+/gi,
];

/**
 * Sanitize error message by:
 * - Limiting length to prevent DoS
 * - Redacting potential secrets/tokens
 * - Categorizing the error type
 */
export function sanitizeError(error: unknown, maxLength = 200): {
  message: string;
  category: NotificationErrorCategory;
} {
  let message = '';
  let category: NotificationErrorCategory = 'UNKNOWN';

  // Extract base message
  if (error instanceof Error) {
    message = error.message;
    
    // Categorize based on error message
    if (error.name === 'AbortError' || message.includes('timed out')) {
      category = 'TIMEOUT';
    } else if (message.includes('Failed to decrypt') || message.includes('decryption')) {
      category = 'DECRYPTION';
    } else if (message.includes('Missing') && message.includes('config')) {
      category = 'INVALID_CONFIG';
    } else if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
      category = 'AUTH';
    } else if (message.includes('429') || message.includes('rate limit')) {
      category = 'RATE_LIMIT';
    } else if (message.match(/\b(5\d{2})\b/)) {
      category = 'SERVER_ERROR';
    } else if (message.match(/\b(4\d{2})\b/)) {
      category = 'CLIENT_ERROR';
    } else if (
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('network')
    ) {
      category = 'NETWORK';
    }
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'Unknown error occurred';
  }

  // Redact potential secrets
  for (const pattern of SECRET_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }

  // Truncate to max length
  if (message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return { message, category };
}

/**
 * Format a sanitized error for storage
 */
export function formatNotificationError(error: unknown): string {
  const { message, category } = sanitizeError(error);
  return `[${category}] ${message}`;
}
