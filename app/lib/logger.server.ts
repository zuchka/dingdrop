import pino from "pino";
import { env } from "~/lib/env.server";

/**
 * Structured logger using Pino
 * Automatically redacts sensitive fields and provides queryable JSON logs
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  
  // Redact sensitive fields from logs
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "secret",
      "apiKey",
      "api_key",
      "authorization",
      "cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.secret",
      "*.apiKey",
      "*.api_key",
      "*.authorization",
      "accountSid",
      "authToken",
      "integrationKey",
      "webhookUrl",
    ],
    remove: true, // Remove the entire value
  },
  
  // Pretty print in development, JSON in production
  transport: process.env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname",
    },
  } : undefined,
  
  // Base fields added to every log
  base: {
    env: process.env.NODE_ENV || "development",
  },
});

/**
 * Create a child logger with additional context
 * Useful for adding request IDs, user IDs, etc.
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log levels:
 * - logger.trace() - Very detailed debugging
 * - logger.debug() - Debugging information
 * - logger.info()  - General informational messages
 * - logger.warn()  - Warning messages
 * - logger.error() - Error messages
 * - logger.fatal() - Fatal errors that cause shutdown
 * 
 * Usage examples:
 * 
 * logger.info({ monitorId, orgId }, "Starting probe execution");
 * logger.error({ err, monitorId }, "Probe execution failed");
 * logger.warn({ count: jobs.length }, "Large batch of jobs queued");
 * 
 * const reqLogger = createLogger({ requestId: "abc-123", userId: "user-456" });
 * reqLogger.info("User authenticated");
 */
