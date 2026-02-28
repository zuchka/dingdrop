import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, Outlet, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { getUserById } from "~/models/user.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return json({ email: user?.email ?? null, enableMonitorsUi: env.ENABLE_MONITORS_UI });
}

export default function AppLayout() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/app" className="font-semibold">Ding.ing</Link>
            <Link to="/app/orgs" className="text-sm text-slate-600">Organizations</Link>
            {data.enableMonitorsUi ? (
              <>
                <Link to="/app/monitors" className="text-sm text-slate-600">Monitors</Link>
                <Link to="/app/alerts" className="text-sm text-slate-600">Alerts</Link>
                <Link to="/app/channels" className="text-sm text-slate-600">Channels</Link>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{data.email}</span>
            <Form action="/logout" method="post">
              <button type="submit" className="rounded border px-3 py-1.5 text-sm">Log out</button>
            </Form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
