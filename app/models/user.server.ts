import { prisma } from "~/lib/db.server";

export function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser({ email, passwordHash }: { email: string; passwordHash: string }) {
  return prisma.user.create({
    data: { email, passwordHash },
  });
}
