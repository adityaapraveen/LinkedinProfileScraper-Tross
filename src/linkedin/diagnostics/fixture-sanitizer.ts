export interface FixtureSanitizationPolicy {
  replacements: Readonly<Record<string, unknown>>;
  preservePaths?: readonly string[];
}

const sensitiveKeyPattern =
  /^(authorization|cookie|set-cookie|csrf-token|csrfToken|password|token)$/i;

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function assertReplacementType(path: string, original: unknown, replacement: unknown): void {
  if (valueType(original) !== valueType(replacement)) {
    throw new Error(`Replacement at ${path} must preserve the original JSON type`);
  }
}

export function sanitizeFixture(input: unknown, policy: FixtureSanitizationPolicy): unknown {
  const preserved = new Set(policy.preservePaths ?? []);
  const unresolved: string[] = [];

  const visit = (value: unknown, path: string, key: string | null): unknown => {
    if (key && sensitiveKeyPattern.test(key)) return '[REDACTED]';
    if (Object.hasOwn(policy.replacements, path)) {
      const replacement = policy.replacements[path];
      assertReplacementType(path, value, replacement);
      return replacement;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, `${path}[${index}]`, null));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [
          childKey,
          visit(childValue, `${path}.${childKey}`, childKey),
        ]),
      );
    }
    if (value === null || typeof value === 'boolean' || key === '$type' || preserved.has(path)) {
      return value;
    }
    unresolved.push(path);
    return value;
  };

  const output = visit(input, '$', null);
  if (unresolved.length > 0) {
    throw new Error(
      `Sanitization policy does not cover ${unresolved.length} scalar path(s): ${unresolved.join(', ')}`,
    );
  }
  return output;
}
