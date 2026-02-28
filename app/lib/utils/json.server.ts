import type { Prisma } from "@prisma/client";

function normalizeJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    const normalizedArray = value
      .map((item) => normalizeJsonValue(item))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
    return normalizedArray;
  }

  if (typeof value === "object" && value !== null) {
    const normalizedObject: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizeJsonValue(item);
      if (normalized !== undefined) {
        normalizedObject[key] = normalized;
      }
    }
    return normalizedObject as Prisma.InputJsonObject;
  }

  return undefined;
}

export function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return normalizeJsonValue(value);
}

export function parseExpectedStatusCodes(value: Prisma.JsonValue | null): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value
    .filter((item): item is number => typeof item === "number" && Number.isInteger(item))
    .filter((code) => code >= 100 && code <= 599);

  return parsed.length > 0 ? parsed : null;
}
