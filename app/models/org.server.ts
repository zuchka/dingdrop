import { prisma } from "~/lib/db.server";

export async function getUserOrgs(userId: string) {
  return prisma.org.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
}

export async function getFirstOrgSlugForUser(userId: string) {
  const org = await prisma.org.findFirst({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { slug: true },
  });
  return org?.slug ?? null;
}

export async function createOrgWithOwner({ userId, name, slug }: { userId: string; name: string; slug: string }) {
  return prisma.org.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });
}

export async function requireOrgMember(userId: string, orgSlug: string) {
  const org = await prisma.org.findFirst({
    where: {
      slug: orgSlug,
      members: { some: { userId } },
    },
  });

  if (!org) {
    throw new Response("Forbidden", { status: 403 });
  }

  return org;
}
