import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { ingestWebhook } from "~/services/ingestion.server";

async function handle(request: Request, endpointKey: string) {
  const stored = await ingestWebhook({ request, endpointKey });
  return json({ ok: true, requestId: stored.id });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const endpointKey = params.endpointKey;

  if (!endpointKey) {
    throw new Response("Not Found", { status: 404 });
  }

  return handle(request, endpointKey);
}

export async function action({ request, params }: ActionFunctionArgs) {
  const endpointKey = params.endpointKey;

  if (!endpointKey) {
    throw new Response("Not Found", { status: 404 });
  }

  return handle(request, endpointKey);
}
