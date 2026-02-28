import { prisma } from "~/lib/db.server";

export function getEnabledAlertRulesForMonitor(monitorId: string) {
  return prisma.alertRule.findMany({
    where: { monitorId, enabled: true },
    include: {
      subscriptions: {
        include: { channel: true },
      },
    },
  });
}

export function listAlertRulesForMonitor(monitorId: string) {
  return prisma.alertRule.findMany({
    where: { monitorId },
    include: {
      subscriptions: {
        include: { channel: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function listAlertRulesForOrg(orgId: string) {
  return prisma.alertRule.findMany({
    where: { monitor: { orgId } },
    include: {
      monitor: { select: { id: true, name: true } },
      subscriptions: {
        include: { channel: true },
      },
    },
    orderBy: [{ monitor: { name: "asc" } }, { createdAt: "asc" }],
  });
}

export function updateAlertRule({
  monitorId,
  ruleId,
  enabled,
}: {
  monitorId: string;
  ruleId: string;
  enabled: boolean;
}) {
  return prisma.alertRule.updateMany({
    where: { id: ruleId, monitorId },
    data: { enabled },
  });
}

export async function replaceAlertRuleSubscriptions({
  ruleId,
  channelIds,
}: {
  ruleId: string;
  channelIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.alertSubscription.deleteMany({ where: { alertRuleId: ruleId } });

    if (channelIds.length > 0) {
      await tx.alertSubscription.createMany({
        data: channelIds.map((channelId) => ({ alertRuleId: ruleId, channelId })),
        skipDuplicates: true,
      });
    }
  });
}
