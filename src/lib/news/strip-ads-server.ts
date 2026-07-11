import { JSDOM } from "jsdom";
import { stripAdsFromRoot, type StripAdsOptions } from "@/lib/news/strip-ads-core";

export function stripAdsFromHtml(html: string, options: StripAdsOptions = {}): string {
  if (!html || !html.includes("<")) return html;

  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  stripAdsFromRoot(body, options);
  return body.innerHTML.trim();
}
