"use client";

import ReactMarkdown from "react-markdown";
import DOMPurify from "isomorphic-dompurify";
import remarkGfm from "remark-gfm";

function normalizeMarkdown(value: string): string {
  // DOMPurify is meant for HTML; we still sanitize as a belt-and-suspenders step,
  // but ensure markdown isn't empty and normalize line endings.
  return value.replace(/\r\n/g, "\n").trim();
}

export function MarkdownPreview({ content }: { content: string }) {
  const sanitized = DOMPurify.sanitize(normalizeMarkdown(content));
  return (
    <div className="cyber-panel p-6 sm:p-8">
      <div className="prose-advisory">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{sanitized}</ReactMarkdown>
      </div>
    </div>
  );
}
