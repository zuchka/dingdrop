import { Link } from "@remix-run/react";

export default function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold">Dingdrop</h1>
      <p className="text-slate-600">Capture, inspect, and replay webhooks in one place.</p>
      <div className="flex gap-3">
        <Link to="/signup" className="rounded bg-slate-900 px-4 py-2 text-white">
          Sign up
        </Link>
        <Link to="/login" className="rounded border px-4 py-2">
          Log in
        </Link>
      </div>
    </main>
  );
}
