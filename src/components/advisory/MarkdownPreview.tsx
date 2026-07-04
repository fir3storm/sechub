"use client";

import ReactMarkdown from "react-markdown";
import DOMPurify from "isomorphic-dompurify";

export function MarkdownPreview({ content }: { content: string }) {
  const sanitized = DOMPurify.sanitize(content);
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none rounded-lg border bg-card p-6">
      <ReactMarkdown>{sanitized}</ReactMarkdown>
    </div>
  );
}
