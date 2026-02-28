export type WebhookEvent = {
  endpointId: string;
  requestId: string;
  receivedAt: string;
};

export interface RealtimeTransport {
  publishWebhookCaptured(event: WebhookEvent): Promise<void>;
}

export class PollingPlaceholderTransport implements RealtimeTransport {
  async publishWebhookCaptured(): Promise<void> {
    return;
  }
}
