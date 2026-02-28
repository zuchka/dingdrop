import { Prisma } from "@prisma/client";
import { prisma } from "~/lib/db.server";
import { generateEndpointKey, generateEndpointSecret } from "~/lib/utils/endpoint-keys";

export async function getEndpointsForOrg(orgId: string) {
  const endpoints = await prisma.endpoint.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orgId: true,
      name: true,
      key: true,
      secret: true,
      isActive: true,
      defaultReplayUrl: true,
      createdAt: true,
      webhookRequests: {
        orderBy: { receivedAt: "desc" },
        take: 1,
        select: { receivedAt: true },
      },
    },
  });

  if (endpoints.length === 0) {
    return [];
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endpointIds = endpoints.map((endpoint) => endpoint.id);

  const counts = await prisma.webhookRequest.groupBy({
    by: ["endpointId"],
    where: {
      endpointId: { in: endpointIds },
      receivedAt: { gte: since },
    },
    _count: { _all: true },
  });

  const countByEndpointId = new Map(counts.map((count) => [count.endpointId, count._count._all]));

  return endpoints.map((endpoint) => ({
    id: endpoint.id,
    orgId: endpoint.orgId,
    name: endpoint.name,
    key: endpoint.key,
    secret: endpoint.secret,
    isActive: endpoint.isActive,
    defaultReplayUrl: endpoint.defaultReplayUrl,
    createdAt: endpoint.createdAt,
    lastRequestAt: endpoint.webhookRequests[0]?.receivedAt ?? null,
    last24hCount: countByEndpointId.get(endpoint.id) ?? 0,
  }));
}

export async function createEndpointForOrg({ orgId, name }: { orgId: string; name: string }) {
  const existing = await prisma.endpoint.findFirst({ where: { orgId, name } });
  if (existing) {
    throw new Error("An endpoint with this name already exists in the organization.");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateEndpointKey();
    const secret = generateEndpointSecret();

    try {
      return await prisma.endpoint.create({
        data: {
          orgId,
          name,
          key,
          secret,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate a unique endpoint key. Please retry.");
}

export async function getEndpointByIdForOrg({ orgId, endpointId }: { orgId: string; endpointId: string }) {
  return prisma.endpoint.findFirst({
    where: {
      id: endpointId,
      orgId,
    },
  });
}

export function getEndpointByKey(key: string) {
  return prisma.endpoint.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      secret: true,
      isActive: true,
    },
  });
}

export async function updateEndpointSettings({
  orgId,
  endpointId,
  isActive,
  defaultReplayUrl,
}: {
  orgId: string;
  endpointId: string;
  isActive: boolean;
  defaultReplayUrl: string | null;
}) {
  const result = await prisma.endpoint.updateMany({
    where: { id: endpointId, orgId },
    data: {
      isActive,
      defaultReplayUrl,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return getEndpointByIdForOrg({ orgId, endpointId });
}
