"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { prepareArticleHtml } from "@/lib/news/article-format";
import { stripAdsFromHtml } from "@/lib/news/strip-ads-client";
import { enhanceArticleFigures, proxyArticleImages } from "@/lib/news/article-images";
import { cn } from "@/lib/utils";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "a",
    "blockquote",
    "br",
    "span",
    "figure",
    "figcaption",
    "img",
  ],
  ALLOWED_ATTR: ["href", "class", "target", "rel", "src", "alt", "title"],
  ADD_ATTR: ["target"],
};

export function ArticleReader({
  body,
  sourceUrl,
  className,
}: {
  body: string;
  sourceUrl?: string | null;
  className?: string;
}) {
  const sanitized = useMemo(() => {
    let structured = prepareArticleHtml(body);

    if (structured.includes("<")) {
      const sourceHost = sourceUrl
        ? (() => {
            try {
              return new URL(sourceUrl).hostname.replace(/^www\./, "");
            } catch {
              return undefined;
            }
          })()
        : undefined;
      structured = stripAdsFromHtml(structured, { sourceHost });
    }

    const clean = DOMPurify.sanitize(structured, PURIFY_CONFIG);
    const withImages = enhanceArticleFigures(proxyArticleImages(clean));

    return withImages.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  }, [body, sourceUrl]);

  return (
    <article
      className={cn("article-reader prose-cyber", className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

export function ArticleLead({ summary }: { summary: string }) {
  return (
    <blockquote className="article-lead">
      <p>{summary}</p>
    </blockquote>
  );
}
