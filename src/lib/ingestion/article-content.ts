/** Minimum body length before we consider RSS content "complete". */
export const SHORT_CONTENT_THRESHOLD = 400;

/** Body length below which the detail page shows the RSS excerpt warning. */
export const MIN_FULL_ARTICLE_LENGTH = 200;

const TEASER_SUFFIX_RE = /(\[\.\.\.\]|…|\.\.\.)\s*$/;

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isShortContent(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < SHORT_CONTENT_THRESHOLD) return true;
  if (TEASER_SUFFIX_RE.test(trimmed)) return true;
  return false;
}

/** Build a summary from body text, breaking at sentence boundaries when possible. */
export function buildSummary(body: string, maxChars: number, fallback = ""): string {
  const text = body.trim();
  if (!text) return fallback;
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastSentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );
  if (lastSentence > maxChars * 0.5) {
    return slice.slice(0, lastSentence + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.7) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }

  return `${slice.trim()}…`;
}

export interface RssItemFields {
  contentEncoded?: string;
  content?: string;
  summary?: string;
}

export function extractRssBody(item: RssItemFields): {
  body: string;
  source: "content:encoded" | "content" | "summary" | "empty";
  rawLengths: Record<string, number>;
} {
  const contentEncoded =
    typeof item.contentEncoded === "string" ? item.contentEncoded : "";
  const content = typeof item.content === "string" ? item.content : "";
  const summary = typeof item.summary === "string" ? item.summary : "";

  const rawLengths = {
    contentEncoded: contentEncoded.length,
    content: content.length,
    summary: summary.length,
  };

  const rawBody = contentEncoded || content || summary || "";
  const body = stripHtmlTags(rawBody);

  const source = contentEncoded
    ? ("content:encoded" as const)
    : content
      ? ("content" as const)
      : summary
        ? ("summary" as const)
        : ("empty" as const);

  return { body, source, rawLengths };
}
