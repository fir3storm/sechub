/** Hostnames and path fragments commonly used by ad networks. */
export const AD_HOST_RE =
  /(?:^|\.)(?:doubleclick|googlesyndication|googleadservices|googleads|gstatic|adnxs|adsrvr|taboola|outbrain|evony|amazon-adsystem|media\.net|pubmatic|rubiconproject|openx|casalemedia|criteo|adform|smartadserver|advertising|moatads|scorecardresearch)/i;

/** CSS selectors for typical ad containers. */
export const AD_SELECTORS = [
  "iframe",
  "ins.adsbygoogle",
  ".adsbygoogle",
  "[data-ad]",
  "[data-ad-slot]",
  "[data-advertisement]",
  "[data-google-query-id]",
  '[class*="ad-container"]',
  '[class*="ad-wrapper"]',
  '[class*="ad-slot"]',
  '[class*="advertisement"]',
  '[class*="adsbygoogle"]',
  '[id*="google_ads"]',
  '[id*="ad-container"]',
  ".sponsored-content",
  ".native-ad",
  ".promo-box",
  ".newsletter-signup",
  ".OUTBRAIN",
  ".taboola",
  ".bc_ad",
  ".article-ad",
  ".in-article-ad",
  ".inline-ad",
];

const AD_CLASS_ID_RE =
  /(?:^|[\s_-])(?:ad|ads|advert|advertisement|sponsored|promo|banner|native-ad|outbrain|taboola)(?:$|[\s_-])/i;

const PROMO_CTA_RE = /\b(play now|download now|free download|install now|sponsored by|advertisement)\b/i;

export interface StripAdsOptions {
  /** Hostname of the article source — used to detect external promo links. */
  sourceHost?: string;
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAdHost(hostname: string): boolean {
  return AD_HOST_RE.test(hostname);
}

function elementClassIdLooksLikeAd(el: Element): boolean {
  const cls = typeof el.className === "string" ? el.className : "";
  const id = el.id || "";
  return AD_CLASS_ID_RE.test(cls) || AD_CLASS_ID_RE.test(id);
}

function isImageOnlyPromoLink(anchor: Element, sourceHost?: string): boolean {
  const href = anchor.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return false;

  const text = (anchor.textContent || "").replace(/\s+/g, " ").trim();
  const imgs = anchor.querySelectorAll("img");
  if (imgs.length === 0) return false;

  const hrefHost = hostFromUrl(href);
  if (hrefHost && isAdHost(hrefHost)) return true;

  // Image-only link to an external site (common inline banner ad pattern).
  const imageOnly = imgs.length >= 1 && text.length < 60;
  if (imageOnly && hrefHost && sourceHost && hrefHost !== sourceHost) {
    return true;
  }

  if (imageOnly && PROMO_CTA_RE.test(text)) return true;

  return false;
}

function isLikelyAdBlock(el: Element, sourceHost?: string): boolean {
  if (elementClassIdLooksLikeAd(el)) return true;

  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  const imgs = el.querySelectorAll("img");
  const links = el.querySelectorAll("a");

  // Short promo blocks with CTA + image (e.g. game ads).
  if (imgs.length > 0 && text.length < 180 && PROMO_CTA_RE.test(text)) {
    return true;
  }

  // Single external image link inside a small block.
  if (links.length === 1 && imgs.length === 1 && text.length < 80) {
    if (isImageOnlyPromoLink(links[0], sourceHost)) return true;
  }

  // Known ad brand names in short blocks.
  if (text.length < 120 && /\b(evony|coin master|raid shadow)\b/i.test(text) && imgs.length > 0) {
    return true;
  }

  return false;
}

/** Remove ad nodes from a parsed HTML subtree. */
export function stripAdsFromRoot(root: ParentNode, options: StripAdsOptions = {}): void {
  const sourceHost = options.sourceHost;

  for (const sel of AD_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => el.remove());
  }

  root.querySelectorAll("a").forEach((anchor) => {
    if (isImageOnlyPromoLink(anchor, sourceHost)) {
      anchor.remove();
    }
  });

  // Remove promo blocks (iterate snapshot — mutating while walking).
  const candidates = root.querySelectorAll("figure, p, div, section, aside, span");
  candidates.forEach((el) => {
    if (isLikelyAdBlock(el, sourceHost)) {
      el.remove();
    }
  });
}
