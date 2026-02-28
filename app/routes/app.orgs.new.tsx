import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { createOrgWithOwner } from "~/models/org.server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  const name = String(formData.get("name") ?? "").trim();
  const inputSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(inputSlug || name);

  if (!name) {
    return json({ error: "Organization name is required." }, { status: 400 });
  }

  if (!slug || slug.length < 2) {
    return json({ error: "Slug must be at least 2 characters." }, { status: 400 });
  }

  try {
    const org = await createOrgWithOwner({ userId, name, slug });
    throw redirect(`/app/orgs/${org.slug}/endpoints`);
  } catch {
    return json({ error: "Could not create organization. Slug may already exist." }, { status: 400 });
  }
}

export default function NewOrgRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="mx-auto max-w-xl rounded border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Create organization</h2>
      <Form method="post" className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Organization name</span>
          <input name="name" type="text" required className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Slug (optional)</span>
          <input name="slug" type="text" placeholder="acme" className="w-full rounded border px-3 py-2" />
        </label>
        {actionData?.error ? <p className="text-sm text-red-600">{actionData.error}</p> : null}
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          Create
        </button>
      </Form>
    </div>
  );
}
