"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { prepareArticleHtml } from "@/lib/news/article-format";
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
  className,
}: {
  body: string;
  className?: string;
}) {
  const sanitized = useMemo(() => {
    const structured = prepareArticleHtml(body);
    const clean = DOMPurify.sanitize(structured, PURIFY_CONFIG);

    return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  }, [body]);

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
