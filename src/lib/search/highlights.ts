/** Wrap matched terms in search highlight markup (safe for display after sanitize). */
export function highlightSearchTerms(text: string, query: string): string {
  const terms = query
    .replace(/[^\w\s"-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !t.startsWith("-"));

  if (terms.length === 0) return escapeHtml(text);

  let result = escapeHtml(text);
  for (const term of terms) {
    const re = new RegExp(`(${escapeRegex(term)})`, "gi");
    result = result.replace(re, '<mark class="search-highlight">$1</mark>');
  }
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildSearchSnippet(
  title: string,
  summary: string,
  query: string,
  maxLen = 220
): string {
  const combined = `${title}. ${summary}`;
  const lower = combined.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  let bestStart = 0;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx >= 0) {
      bestStart = Math.max(0, idx - 40);
      break;
    }
  }

  const slice = combined.slice(bestStart, bestStart + maxLen);
  const snippet = (bestStart > 0 ? "…" : "") + slice + (bestStart + maxLen < combined.length ? "…" : "");
  return highlightSearchTerms(snippet, query);
}
