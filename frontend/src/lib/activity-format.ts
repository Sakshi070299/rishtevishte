function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function prettyDate(isoLike: string): string {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function formatActivityDetails(action: string, details: string | null): { text: string; title: string } {
  const raw = (details ?? '').trim();
  if (!raw) return { text: '—', title: '—' };

  const looksJson = raw.startsWith('{') || raw.startsWith('[');
  const parsed = looksJson ? safeJsonParse(raw) : null;

  // Common strings already human readable
  if (!parsed) {
    // Normalize "From: ... To: ..." to a nicer form if possible
    const m = raw.match(/From:\s*([^\s]+).*To:\s*([^\s]+)/i);
    if (m) return { text: `From ${prettyDate(m[1])} → ${prettyDate(m[2])}`, title: raw };
    return { text: raw, title: raw };
  }

  // Arrays: join concise
  if (Array.isArray(parsed)) {
    const text = parsed.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ');
    return { text: text || raw, title: raw };
  }

  if (!isPlainObject(parsed)) return { text: raw, title: raw };

  // Search pagination shape: { page: "1", limit: "15" }
  if ('page' in parsed || 'limit' in parsed) {
    const page = parsed.page != null ? String(parsed.page) : undefined;
    const limit = parsed.limit != null ? String(parsed.limit) : undefined;
    const parts = [
      page ? `Page ${page}` : null,
      limit ? `Limit ${limit}` : null,
      parsed.search ? `Query: ${String(parsed.search)}` : null,
    ].filter(Boolean) as string[];
    if (parts.length) return { text: parts.join(' · '), title: raw };
  }

  // Date range: { from, to } or { dateFrom, dateTo }
  const from = (parsed.from ?? parsed.dateFrom) as unknown;
  const to = (parsed.to ?? parsed.dateTo) as unknown;
  if (typeof from === 'string' && typeof to === 'string') {
    return { text: `From ${prettyDate(from)} → ${prettyDate(to)}`, title: raw };
  }

  // Profile actions (EDIT, offline create, etc.)
  if (typeof parsed.profileId === 'string') {
    const pm = typeof parsed.paymentMethod === 'string' ? parsed.paymentMethod : undefined;
    const inv = typeof parsed.invoiceNumber === 'string' ? parsed.invoiceNumber : undefined;
    const methods = Array.isArray(parsed.paymentMethods)
      ? (parsed.paymentMethods as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
    const methodsLabel = methods.length ? methods.join(' + ') : null;
    const parts = [
      `Profile ${parsed.profileId.slice(0, 8)}…`,
      methodsLabel ? methodsLabel : null,
      pm ? `Payment ${pm}` : null,
      inv ? `Invoice ${inv}` : null,
    ].filter(Boolean) as string[];
    return { text: parts.join(' · '), title: raw };
  }

  // Fallback: show key:value pairs (skip huge values)
  const pairs = Object.entries(parsed)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

  const text = pairs.join(' · ') || raw;
  return { text, title: raw };
}

