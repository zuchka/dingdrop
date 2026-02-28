import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { getFirstOrgSlugForUser } from "~/models/org.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const slug = await getFirstOrgSlugForUser(userId);

  if (!slug) {
    throw redirect("/app/orgs/new");
  }

  throw redirect("/app/monitors");
}

export default function AppIndexRoute() {
  return null;
}
