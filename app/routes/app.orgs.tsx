import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { getUserOrgs } from "~/models/org.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const orgs = await getUserOrgs(userId);
  return json({ orgs });
}

export default function OrgsRoute() {
  const { orgs } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <Link to="/app/orgs/new" className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
          New organization
        </Link>
      </div>

      {orgs.length === 0 ? (
        <div className="rounded border bg-white p-6">
          <p className="text-slate-600">No organizations yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} className="border-t">
                  <td className="px-4 py-3">{org.name}</td>
                  <td className="px-4 py-3 text-slate-600">{org.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{org._count.members}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/app/orgs/${org.slug}/endpoints`} className="underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Outlet />
    </div>
  );
}
