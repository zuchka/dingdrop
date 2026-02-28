import { randomBytes } from "node:crypto";

export function generateEndpointKey() {
  return `dd_${randomBytes(12).toString("base64url")}`;
}

export function generateEndpointSecret() {
  return `dds_${randomBytes(24).toString("base64url")}`;
}
