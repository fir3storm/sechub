import { stripHtmlTags } from "@/lib/ingestion/article-content";

const HTML_TAG_RE = /<(?:p|div|h[1-6]|ul|ol|li|article|section|br|blockquote|strong|em)\b/i;

export function isHtmlContent(text: string): boolean {
  return HTML_TAG_RE.test(text);
}

export function getReadingStats(text: string): { words: number; minutes: number } {
  const plain = stripHtmlTags(text);
  const words = plain.split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.ceil(words / 220)) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightInline(text: string): string {
  return text
    .replace(/\b(CVE-\d{4}-\d+)\b/g, '<span class="article-cve">$1</span>')
    .replace(
      /\b(phishing|ransomware|malware|zero-day|exploit|vulnerability|breach|attack)\b/gi,
      "<strong>$1</strong>"
    );
}

function isLikelyHeading(text: string): boolean {
  if (text.length > 120) return false;
  if (/^\d+\.\s+[A-Z]/.test(text)) return true;
  if (/^(introduction|conclusion|summary|key points|mitigation|overview)/i.test(text)) return true;
  if (!/[.!?]$/.test(text) && text.length < 90 && /^[A-Z]/.test(text)) return true;
  return false;
}

function isListBlock(lines: string[]): boolean {
  if (lines.length < 2) return false;
  return lines.every((line) => /^[\s]*(?:[-*•]|\d+\.)\s+\S/.test(line));
}

function renderList(lines: string[]): string {
  const ordered = lines.every((line) => /^[\s]*\d+\.\s/.test(line));
  const tag = ordered ? "ol" : "ul";
  const items = lines
    .map((line) => line.replace(/^[\s]*(?:[-*•]|\d+\.)\s+/, "").trim())
    .filter(Boolean)
    .map((item) => `<li>${highlightInline(escapeHtml(item))}</li>`)
    .join("");
  return `<${tag} class="article-list">${items}</${tag}>`;
}

function structureDenseText(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  const parts: string[] = [];
  let buffer: string[] = [];

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (isLikelyHeading(sentence) && buffer.length > 0) {
      parts.push(`<p>${highlightInline(escapeHtml(buffer.join(" ")))}</p>`);
      buffer = [];
      parts.push(`<h2>${escapeHtml(sentence)}</h2>`);
      continue;
    }

    buffer.push(sentence);
    if (buffer.length >= 3) {
      parts.push(`<p>${highlightInline(escapeHtml(buffer.join(" ")))}</p>`);
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    parts.push(`<p>${highlightInline(escapeHtml(buffer.join(" ")))}</p>`);
  }

  return parts.join("\n");
}

/** Turn plain extracted text into structured HTML for display. */
export function structurePlainTextToHtml(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return "";

  if (!normalized.includes("\n") && normalized.length > 500) {
    return structureDenseText(normalized);
  }

  const blocks = normalized.split(/\n\n+/);
  const parts: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);

    if (isListBlock(lines)) {
      parts.push(renderList(lines));
      continue;
    }

    if (lines.length === 1 && isLikelyHeading(trimmed)) {
      parts.push(`<h2>${escapeHtml(trimmed)}</h2>`);
      continue;
    }

    if (lines.length === 1 && trimmed.length > 400) {
      parts.push(structureDenseText(trimmed));
      continue;
    }

    for (const line of lines) {
      if (isLikelyHeading(line)) {
        parts.push(`<h2>${escapeHtml(line)}</h2>`);
      } else {
        parts.push(`<p>${highlightInline(escapeHtml(line))}</p>`);
      }
    }
  }

  return parts.join("\n");
}

export function prepareArticleHtml(body: string): string {
  if (isHtmlContent(body)) return body;
  return structurePlainTextToHtml(body);
}
