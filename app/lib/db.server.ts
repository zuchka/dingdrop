import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Add connection pool limits to DATABASE_URL for Supabase session-mode pooler
// Supabase session mode has a default limit of 15 connections
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "";

  // Parse URL to add connection pool parameters
  try {
    const dbUrl = new URL(url);

    // Only add pool limits if not already present
    if (!dbUrl.searchParams.has("connection_limit")) {
      // Limit to 3 connections to prevent exhausting Supabase's pool
      dbUrl.searchParams.set("connection_limit", "3");
      dbUrl.searchParams.set("pool_timeout", "10");
    }

    return dbUrl.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? process.env.PRISMA_LOG_QUERIES === "true"
          ? ["query", "error", "warn"]
          : ["error", "warn"]
        : ["error"],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
