import { prisma } from "~/lib/db.server";

export async function resetDatabase() {
  await prisma.$transaction([
    prisma.replayAttempt.deleteMany(),
    prisma.webhookRequest.deleteMany(),
    prisma.endpoint.deleteMany(),
    prisma.orgMember.deleteMany(),
    prisma.org.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export function uniqueValue(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
