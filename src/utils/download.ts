export function downloadText(filename: string, content: string, mimeType: string): void {
  const isCsv = mimeType.toLowerCase().includes('csv');
  const payload = isCsv && !content.startsWith('\uFEFF') ? `\uFEFF${content}` : content;
  const type = isCsv ? 'text/csv;charset=utf-8' : mimeType;
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function neutralizeCsvFormula(value: unknown): string {
  const text = String(value ?? '');
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown): string => `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
  return [headers.map(escape).join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\r\n');
}
