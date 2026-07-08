import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { stripHtmlTags } from "@/lib/ingestion/article-content";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const USER_AGENT =
  "SecHub/1.0 (+https://sechub.online; threat-intel-ingest) Mozilla/5.0 compatible";

export interface FetchArticleResult {
  text: string;
  html: string | null;
  title: string | null;
  excerpt: string | null;
  wordCount: number;
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchFullArticle(url: string): Promise<FetchArticleResult | null> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) return null;

    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent?.trim()) {
      return extractFallbackText(html, url);
    }

    const text = normalizeExtractedText(article.textContent);
    if (text.length < 100) return null;

    return {
      text,
      html: article.content ?? null,
      title: article.title ?? null,
      excerpt: article.excerpt ?? null,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  } catch (err) {
    if (err instanceof Error && err.name !== "AbortError") {
      console.warn(`Article fetch failed for ${url}:`, err.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractFallbackText(html: string, url: string): FetchArticleResult | null {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const selectors = ["article", "main", '[role="main"]', ".post-content", ".entry-content"];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el?.textContent && el.textContent.trim().length > 200) {
      const text = normalizeExtractedText(el.textContent);
      const innerHtml = el.innerHTML?.trim();
      return {
        text,
        html: innerHtml && innerHtml.length > 200 ? innerHtml : null,
        title: doc.title || null,
        excerpt: null,
        wordCount: text.split(/\s+/).filter(Boolean).length,
      };
    }
  }

  const bodyText = stripHtmlTags(doc.body?.innerHTML ?? "");
  if (bodyText.length < 200) return null;

  return {
    text: bodyText,
    html: null,
    title: doc.title || null,
    excerpt: null,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
  };
}

/** Polite delay between consecutive full-page fetches. */
export function delayBetweenFetches(ms = 1000): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
