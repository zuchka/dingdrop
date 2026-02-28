import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { Toast } from "~/components/ui/toast";
import { env } from "~/lib/env.server";
import { requireUserId } from "~/lib/session.server";
import { getEndpointByIdForOrg, updateEndpointSettings } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
    endpoint,
    ingestionUrl: `${env.APP_BASE_URL}/i/${endpoint.key}`,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;
  const endpointId = params.endpointId;

  if (!orgSlug || !endpointId) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const formData = await request.formData();
  const isActive = formData.get("isActive") === "on";
  const defaultReplayUrlRaw = String(formData.get("defaultReplayUrl") ?? "").trim();

  if (defaultReplayUrlRaw && !isValidUrl(defaultReplayUrlRaw)) {
    return json({ error: "Default replay URL must be a valid http(s) URL." }, { status: 400 });
  }

  const endpoint = await updateEndpointSettings({
    orgId: org.id,
    endpointId,
    isActive,
    defaultReplayUrl: defaultReplayUrlRaw || null,
  });

  if (!endpoint) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ ok: true, updatedAt: endpoint.updatedAt.toISOString() });
}

export default function EndpointSettingsRoute() {
  const { endpoint, ingestionUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!actionData) {
      return;
    }

    if ("error" in actionData && actionData.error) {
      setToast({ tone: "error", message: actionData.error });
      return;
    }

    if ("ok" in actionData && actionData.ok) {
      setToast({ tone: "success", message: "Settings saved." });
    }
  }, [actionData]);

  return (
    <section className="rounded border bg-white p-6">
      {toast ? <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} /> : null}
      <h2 className="text-lg font-semibold">Endpoint settings</h2>
      <p className="mt-1 text-sm text-slate-600">Configure endpoint behavior and default replay target.</p>

      <div className="mt-5 space-y-4 rounded border bg-slate-50 p-4 text-sm">
        <div>
          <p className="font-medium">Ingestion URL</p>
          <p className="break-all text-slate-700">{ingestionUrl}</p>
          <button
            type="button"
            className="mt-1 text-xs underline"
            onClick={() => navigator.clipboard.writeText(ingestionUrl)}
          >
            Copy ingestion URL
          </button>
        </div>

        <div>
          <p className="font-medium">Endpoint secret</p>
          <p className="break-all font-mono text-xs text-slate-700">{endpoint.secret}</p>
          <button
            type="button"
            className="mt-1 text-xs underline"
            onClick={() => navigator.clipboard.writeText(endpoint.secret)}
          >
            Copy secret
          </button>
        </div>
      </div>

      <Form method="post" className="mt-6 max-w-xl space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={endpoint.isActive} />
          Endpoint active
        </label>

        <label className="block">
          <span className="mb-1 block text-sm">Default replay URL</span>
          <input
            name="defaultReplayUrl"
            type="url"
            defaultValue={endpoint.defaultReplayUrl ?? ""}
            placeholder="https://example.com/webhooks/target"
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Save settings
        </button>
      </Form>
    </section>
  );
}
