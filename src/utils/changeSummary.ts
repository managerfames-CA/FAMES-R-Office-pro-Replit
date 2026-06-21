const IGNORED_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'createdByName', 'updatedByName',
  'recordVersion', 'duplicateOverrideReason'
]);

const SENSITIVE_NAME = /password|secret|token|api.?key/i;

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (IGNORED_FIELDS.has(key) || SENSITIVE_NAME.test(key)) continue;
      flatten(child, path, output);
    }
  } else {
    output[prefix] = value;
  }
  return output;
}

function readableName(path: string): string {
  return path
    .replace(/^financial\./, 'Financial ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\./g, ' ')
    .replace(/^./, letter => letter.toUpperCase());
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export function summarizeChanges(before: unknown, after: unknown): string {
  const previous = flatten(before);
  const next = flatten(after);
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changes: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(previous[key]) === JSON.stringify(next[key])) continue;
    changes.push(`${readableName(key)}: ${readableValue(previous[key])} → ${readableValue(next[key])}`);
  }
  return changes.join('; ');
}
