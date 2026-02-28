import { prisma } from "~/lib/db.server";
import { encryptJson } from "~/lib/crypto.server";
import type { NotificationChannelType } from "@prisma/client";

export function listChannelsForOrg(orgId: string) {
  return prisma.notificationChannel.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      enabled: true,
      createdAt: true,
    },
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

export async function updateChannelForOrg({
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
  // First verify the channel exists and belongs to the org
  const existing = await prisma.notificationChannel.findFirst({
    where: { id: channelId, orgId },
  });

  if (!existing) {
    throw new Error(`Channel ${channelId} not found or does not belong to organization`);
  }

  // Now perform the update
  return prisma.notificationChannel.update({
    where: { id: channelId },
    data: {
      name,
      enabled,
      configEncrypted: config ? encryptJson(config) : undefined,
    },
  });
}

export async function deleteChannelForOrg(orgId: string, channelId: string) {
  // Verify the channel exists and belongs to the org before deletion
  const existing = await prisma.notificationChannel.findFirst({
    where: { id: channelId, orgId },
  });

  if (!existing) {
    throw new Error(`Channel ${channelId} not found or does not belong to organization`);
  }

  // Delete the channel (cascade will handle related records)
  return prisma.notificationChannel.delete({
    where: { id: channelId },
  });
}
