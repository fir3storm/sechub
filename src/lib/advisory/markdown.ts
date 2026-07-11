/** Strip AI code fences and normalize advisory markdown for rendering. */
export function cleanAdvisoryMarkdown(raw: string): string {
  if (!raw) return "";

  let text = raw.replace(/\r\n/g, "\n").trim();

  const fullFence = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fullFence) {
    text = fullFence[1].trim();
  } else if (text.startsWith("```")) {
    text = text.replace(/^```(?:markdown|md)?\s*\n?/i, "").replace(/\n```\s*$/, "").trim();
  }

  return text;
}

/** Remove leading # title when the preview header already shows the title. */
export function stripLeadingMarkdownTitle(markdown: string): string {
  const lines = markdown.split("\n");
  if (lines[0]?.match(/^#\s+[^#]/)) {
    return lines.slice(1).join("\n").replace(/^\s+/, "");
  }
  return markdown;
}

/** Plain-text excerpt for list cards (no markdown syntax). */
export function getAdvisoryExcerpt(content: string, maxLen = 200): string {
  const clean = cleanAdvisoryMarkdown(content)
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*|__|\*|_|`/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trim()}…`;
}
