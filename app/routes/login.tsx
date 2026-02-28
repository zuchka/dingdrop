import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import { createUserSession, getUserId } from "~/lib/session.server";
import { login } from "~/lib/auth.server";

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
  const redirectTo = String(formData.get("redirectTo") ?? "/app");

  const user = await login(email, password);
  if (!user) {
    return json({ error: "Invalid email or password." }, { status: 400 });
  }

  return createUserSession({ request, userId: user.id, redirectTo });
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/app";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      <Form method="post" className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input name="email" type="email" required className="w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Password</span>
          <input name="password" type="password" required className="w-full rounded border px-3 py-2" />
        </label>
        {actionData?.error ? <p className="text-sm text-red-600">{actionData.error}</p> : null}
        <button type="submit" className="w-full rounded bg-slate-900 px-4 py-2 text-white">
          Log in
        </button>
      </Form>
      <p className="mt-4 text-sm text-slate-600">
        Need an account? <Link to="/signup" className="underline">Sign up</Link>
      </p>
    </main>
  );
}
