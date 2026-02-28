import { Prisma } from "@prisma/client";
import { INBOX_QUERY_LIMIT } from "~/lib/constants";
import { prisma } from "~/lib/db.server";

export type CreateWebhookRequestInput = {
  endpointId: string;
  method: string;
  path: string;
  query: Prisma.InputJsonValue | null;
  headers: Prisma.InputJsonValue;
  bodyRaw: Buffer;
  bodyText: string | null;
  bodyJson: Prisma.InputJsonValue | null;
  contentType: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  sizeBytes: number;
};

export function createWebhookRequest(data: CreateWebhookRequestInput) {
  return prisma.webhookRequest.create({
    data: {
      ...data,
      bodyRaw: new Uint8Array(data.bodyRaw),
      query: data.query ?? Prisma.DbNull,
      bodyJson: data.bodyJson ?? Prisma.DbNull,
    },
  });
}

export function getEndpointInboxRequests({
  endpointId,
  method,
  contentType,
  limit = INBOX_QUERY_LIMIT,
}: {
  endpointId: string;
  method?: string;
  contentType?: string;
  limit?: number;
}) {
  return prisma.webhookRequest.findMany({
    where: {
      endpointId,
      method: method || undefined,
      contentType: contentType
        ? {
            contains: contentType,
            mode: "insensitive",
          }
        : undefined,
    },
    orderBy: { receivedAt: "desc" },
    take: Math.min(limit, INBOX_QUERY_LIMIT),
    select: {
      id: true,
      method: true,
      contentType: true,
      sizeBytes: true,
      receivedAt: true,
    },
  });
}

export function getWebhookRequestByIdForEndpoint({
  endpointId,
  requestId,
}: {
  endpointId: string;
  requestId: string;
}) {
  return prisma.webhookRequest.findFirst({
    where: {
      id: requestId,
      endpointId,
    },
    select: {
      id: true,
      method: true,
      path: true,
      query: true,
      headers: true,
      bodyRaw: true,
      bodyText: true,
      bodyJson: true,
      contentType: true,
      sourceIp: true,
      userAgent: true,
      sizeBytes: true,
      receivedAt: true,
    },
  });
}
