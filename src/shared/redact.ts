const SENSITIVE_KEY =
  /(token|secret|password|authorization|api[_-]?key|credential|private[_-]?key|access[_-]?key|cookie|set-cookie|bearer|env|value)$/i;

export function redactValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) {
    return typeof value === "string" && value.length === 0 ? "" : "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [nextKey, nextValue] of Object.entries(value as Record<string, unknown>)) {
      output[nextKey] = redactValue(nextValue, nextKey);
    }
    return output;
  }
  return value;
}

export function redactJson(value: unknown): unknown {
  return redactValue(value);
}
