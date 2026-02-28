import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { createEndpointForOrg } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;
  if (!orgSlug) {
    throw new Response("Not Found", { status: 404 });
  }

  await requireOrgMember(userId, orgSlug);
  return null;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;

  if (!orgSlug) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return json({ error: "Endpoint name is required." }, { status: 400 });
  }

  try {
    const endpoint = await createEndpointForOrg({ orgId: org.id, name });
    throw redirect(`/app/orgs/${org.slug}/endpoints/${endpoint.id}/settings`);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create endpoint.",
      },
      { status: 400 },
    );
  }
}

export default function NewEndpointRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <section className="rounded border bg-white p-6">
      <h2 className="text-lg font-semibold">Create endpoint</h2>
      <Form method="post" className="mt-4 max-w-xl space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Name</span>
          <input
            name="name"
            type="text"
            required
            placeholder="Stripe webhook"
            className="w-full rounded border px-3 py-2"
          />
        </label>
        {actionData?.error ? <p className="text-sm text-red-600">{actionData.error}</p> : null}
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Create endpoint
        </button>
      </Form>
    </section>
  );
}
