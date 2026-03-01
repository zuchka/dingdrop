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
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 flex-col justify-between">
        <div className="animate-fade-in">
          <Link to="/" className="text-3xl font-bold text-white hover:opacity-90 transition-opacity">
            Ding.ing
          </Link>
        </div>

        <div className="animate-slide-up">
          <h2 className="text-4xl font-bold text-white mb-6">
            Welcome back
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Continue monitoring your services with confidence
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1 flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-200">
                24/7 uptime monitoring for all your services
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1 flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-200">
                Instant alerts through multiple channels
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center mt-1 flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-200">
                Detailed insights and incident tracking
              </p>
            </div>
          </div>
        </div>

        <div className="text-slate-400 text-sm">
          Powered by Prometheus Blackbox Exporter
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="text-3xl font-bold text-slate-900 hover:opacity-80 transition-opacity">
              Ding.ing
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Log in to your account
            </h1>
            <p className="text-slate-600">
              Enter your credentials to access your dashboard
            </p>
          </div>

          <Form method="post" className="space-y-5">
            <input type="hidden" name="redirectTo" value={redirectTo} />

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            {actionData?.error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{actionData.error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/20 transition-all transform active:scale-[0.98]"
            >
              Log in
            </button>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-slate-600">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-slate-900 hover:underline focus:outline-none focus:underline"
              >
                Sign up
              </Link>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-slate-500">
              By logging in, you agree to our{" "}
              <Link to="/terms" className="underline hover:text-slate-700">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline hover:text-slate-700">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
