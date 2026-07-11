import { stripAdsFromRoot, type StripAdsOptions } from "@/lib/news/strip-ads-core";

export function stripAdsFromHtml(html: string, options: StripAdsOptions = {}): string {
  if (!html || !html.includes("<")) return html;
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  stripAdsFromRoot(doc.body, options);
  return doc.body.innerHTML.trim();
}
