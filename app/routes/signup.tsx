import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { register } from "~/lib/auth.server";
import { createUserSession, getUserId } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  if (userId) {
    throw redirect("/app");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    const user = await register(email, password);
    return createUserSession({ request, userId: user.id, redirectTo: "/app/orgs/new" });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Failed to create account." },
      { status: 400 },
    );
  }
}

export default function SignupPage() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Create account</h1>
      <Form method="post" className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input name="email" type="email" required className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Password (min 8 chars)</span>
          <input name="password" type="password" required minLength={8} className="w-full rounded border px-3 py-2" />
        </label>
        {actionData?.error ? <p className="text-sm text-red-600">{actionData.error}</p> : null}
        <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-white">
          Create account
        </button>
      </Form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account? <Link to="/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}
