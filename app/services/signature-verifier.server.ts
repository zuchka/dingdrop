export type SignatureVerificationInput = {
  provider: string;
  headers: Record<string, string>;
  rawBody: Buffer;
  secret: string;
};

export type SignatureVerificationResult = {
  ok: boolean;
  reason?: string;
};

export interface SignatureVerifier {
  verify(input: SignatureVerificationInput): Promise<SignatureVerificationResult>;
}

export class NoopSignatureVerifier implements SignatureVerifier {
  async verify(): Promise<SignatureVerificationResult> {
    return { ok: true, reason: "MVP: provider signature verification is not enabled." };
  }
}
