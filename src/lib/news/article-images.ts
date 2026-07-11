import { AD_HOST_RE } from "@/lib/news/strip-ads-core";

/** Rewrite external img src to SecHub proxy (privacy + fewer broken hotlinks). */
export function proxyArticleImages(html: string): string {
  if (!html.includes("<img")) return html;

  return html.replace(/<img\b([^>]*?)>/gi, (full, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) return full;

    const src = srcMatch[1];
    if (src.startsWith("/api/news/image-proxy") || src.startsWith("data:")) {
      return full;
    }

    const proxied = `/api/news/image-proxy?url=${encodeURIComponent(src)}`;
    let nextAttrs = attrs.replace(/\bsrc=["'][^"']+["']/i, `src="${proxied}"`);

    if (!/\bloading=/i.test(nextAttrs)) {
      nextAttrs += ' loading="lazy"';
    }
    if (!/\bdecoding=/i.test(nextAttrs)) {
      nextAttrs += ' decoding="async"';
    }

    return `<img${nextAttrs}>`;
  });
}

/** Wrap standalone images in figure/figcaption when alt text is present. */
export function enhanceArticleFigures(html: string): string {
  if (!html.includes("<img")) return html;

  return html.replace(
    /<p>\s*(<img\b[^>]*alt=["']([^"']+)["'][^>]*>)\s*<\/p>/gi,
    (_m, imgTag: string, alt: string) => {
      if (/figcaption/i.test(imgTag)) return _m;
      const caption = alt.trim();
      if (!caption || caption.length < 4) return `<figure class="article-figure">${imgTag}</figure>`;
      return `<figure class="article-figure">${imgTag}<figcaption>${caption}</figcaption></figure>`;
    }
  );
}

export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.")) {
      return false;
    }
    if (AD_HOST_RE.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}
