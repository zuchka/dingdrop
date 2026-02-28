import type { LoaderFunctionArgs } from "@remix-run/node";
import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { getEndpointByIdForOrg } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";

function tabClassName(isActive: boolean) {
  return `rounded px-3 py-1.5 text-sm ${isActive ? "bg-slate-900 text-white" : "border bg-white text-slate-700"}`;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;
  const endpointId = params.endpointId;

  if (!orgSlug || !endpointId) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const endpoint = await getEndpointByIdForOrg({ orgId: org.id, endpointId });

  if (!endpoint) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({
    org: { id: org.id, slug: org.slug, name: org.name },
    endpoint: {
      id: endpoint.id,
      name: endpoint.name,
      key: endpoint.key,
      isActive: endpoint.isActive,
    },
  });
}

export default function EndpointLayoutRoute() {
  const { org, endpoint } = useLoaderData<typeof loader>();

  return (
    <section className="space-y-4">
      <div className="rounded border bg-white p-4">
        <h2 className="text-lg font-semibold">{endpoint.name}</h2>
        <p className="text-sm text-slate-600">Endpoint key: {endpoint.key}</p>
        <div className="mt-3 flex gap-2">
          <NavLink to={`/app/orgs/${org.slug}/endpoints/${endpoint.id}`} end className={({ isActive }) => tabClassName(isActive)}>
            Inbox
          </NavLink>
          <NavLink to={`/app/orgs/${org.slug}/endpoints/${endpoint.id}/settings`} className={({ isActive }) => tabClassName(isActive)}>
            Settings
          </NavLink>
        </div>
      </div>
      <Outlet />
    </section>
  );
}
