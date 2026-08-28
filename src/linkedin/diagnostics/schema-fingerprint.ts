import { createHash } from 'node:crypto';

export interface SchemaFingerprint {
  hash: string;
  paths: string[];
}

function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value === 'object' ? 'object' : typeof value;
}

function collect(value: unknown, path: string, output: Set<string>): void {
  output.add(`${path}:${valueType(value)}`);
  if (Array.isArray(value)) {
    for (const item of value) collect(item, `${path}[]`, output);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const key of Object.keys(value).sort()) {
    collect((value as Record<string, unknown>)[key], `${path}.${key}`, output);
  }
}

export function schemaFingerprint(value: unknown): SchemaFingerprint {
  const structuralPaths = new Set<string>();
  collect(value, '$', structuralPaths);
  const paths = [...structuralPaths].sort();
  return {
    hash: createHash('sha256').update(paths.join('\n')).digest('hex'),
    paths,
  };
}
