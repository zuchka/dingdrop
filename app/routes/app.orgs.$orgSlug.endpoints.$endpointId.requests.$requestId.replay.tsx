import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/lib/session.server";
import { getEndpointByIdForOrg } from "~/models/endpoint.server";
import { requireOrgMember } from "~/models/org.server";
import { getWebhookRequestByIdForEndpoint } from "~/models/webhook-request.server";
import { replayWebhook } from "~/services/replay.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const orgSlug = params.orgSlug;
  const endpointId = params.endpointId;
  const requestId = params.requestId;

  if (!orgSlug || !endpointId || !requestId) {
    throw new Response("Not Found", { status: 404 });
  }

  const org = await requireOrgMember(userId, orgSlug);
  const endpoint = await getEndpointByIdForOrg({ orgId: org.id, endpointId });

  if (!endpoint) {
    throw new Response("Not Found", { status: 404 });
  }

  const webhookRequest = await getWebhookRequestByIdForEndpoint({ endpointId: endpoint.id, requestId });
  if (!webhookRequest) {
    throw new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const targetUrlRaw = String(formData.get("targetUrl") ?? "").trim();

  try {
    const attempt = await replayWebhook({
      webhookRequest: {
        id: webhookRequest.id,
        method: webhookRequest.method,
        headers: webhookRequest.headers,
        bodyRaw: Buffer.from(webhookRequest.bodyRaw),
      },
      endpoint: {
        defaultReplayUrl: endpoint.defaultReplayUrl,
      },
      explicitTargetUrl: targetUrlRaw || null,
    });

    return json({
      ok: attempt.ok,
      replayAttemptId: attempt.id,
      responseStatus: attempt.responseStatus,
      errorMessage: attempt.errorMessage,
      durationMs: attempt.durationMs,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "Replay failed.",
      },
      { status: 400 },
    );
  }
}
