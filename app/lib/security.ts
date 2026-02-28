import { timingSafeEqual } from "node:crypto";

export function secretsMatch(actual: string, provided: string | null | undefined) {
  if (!provided) {
    return false;
  }

  const actualBuf = Buffer.from(actual);
  const providedBuf = Buffer.from(provided);

  if (actualBuf.length !== providedBuf.length) {
    return false;
  }

  return timingSafeEqual(actualBuf, providedBuf);
}
