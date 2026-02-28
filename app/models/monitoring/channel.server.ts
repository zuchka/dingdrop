import { prisma } from "~/lib/db.server";
import { encryptJson } from "~/lib/crypto.server";
import type { NotificationChannelType } from "@prisma/client";

export function listChannelsForOrg(orgId: string) {
  return prisma.notificationChannel.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });
}

export function getChannelForOrg(orgId: string, channelId: string) {
  return prisma.notificationChannel.findFirst({
    where: { id: channelId, orgId },
  });
}

export function createChannelForOrg({
  orgId,
  type,
  name,
  config,
}: {
  orgId: string;
  type: NotificationChannelType;
  name: string;
  config: Record<string, unknown>;
}) {
  return prisma.notificationChannel.create({
    data: {
      orgId,
      type,
      name,
      configEncrypted: encryptJson(config),
    },
  });
}

export function updateChannelForOrg({
  orgId,
  channelId,
  name,
  enabled,
  config,
}: {
  orgId: string;
  channelId: string;
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}) {
  return prisma.notificationChannel.updateMany({
    where: { id: channelId, orgId },
    data: {
      name,
      enabled,
      configEncrypted: config ? encryptJson(config) : undefined,
    },
  });
}
