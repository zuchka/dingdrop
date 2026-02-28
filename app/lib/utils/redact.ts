const REDACTED = "[REDACTED]";

const SENSITIVE_KEY = /(authorization|cookie|set-cookie|token|secret|password|api[-_]?key|signature)/i;

const SENSITIVE_VALUE = [
  /bearer\s+[a-z0-9._\-~+/]+=*/i,
  /\b(sk|pk)_(live|test)_[a-z0-9]{8,}\b/i,
  /\b[a-f0-9]{32,}\b/i,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
];

function redactString(value: string) {
  for (const pattern of SENSITIVE_VALUE) {
    if (pattern.test(value)) {
      return REDACTED;
    }
  }
  return value;
}

export function redactValue(value: unknown, parentKey?: string): unknown {
  if (parentKey && SENSITIVE_KEY.test(parentKey)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactValue(nested, key);
    }
    return result;
  }

  return value;
}
