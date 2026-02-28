import type { Prisma } from "@prisma/client";
import { prisma } from "~/lib/db.server";

export function createReplayAttempt(data: {
  webhookRequestId: string;
  targetUrl: string;
  requestHeaders: Prisma.InputJsonValue;
  responseStatus: number | null;
  responseBody: string | null;
  ok: boolean;
  durationMs: number;
  errorMessage: string | null;
}) {
  return prisma.replayAttempt.create({ data });
}

export function getReplayAttemptsForRequest(webhookRequestId: string, take = 20) {
  return prisma.replayAttempt.findMany({
    where: { webhookRequestId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      targetUrl: true,
      requestHeaders: true,
      responseStatus: true,
      ok: true,
      durationMs: true,
      errorMessage: true,
      createdAt: true,
    },
  });
}
