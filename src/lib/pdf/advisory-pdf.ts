import PDFDocument from "pdfkit";
import { marked } from "marked";
import type PDFKit from "pdfkit";
import {
  getTlpBannerColors,
  getRiskRatingColors,
  RISK_RATING_COLORS,
  THREAT_TYPE_LABELS,
  AI_SUMMARY_MODE_LABELS,
  type ThreatType,
  type AISummaryMode,
} from "@/lib/advisory/template";

export type AdvisoryPdfMeta = {
  title: string;
  status?: string | null;
  updatedAt?: Date | null;
  author?: string | null;
  classification?: string | null;
  generatedAt?: Date;
  advisoryId?: string;
  templateName?: string | null;
  threatType?: string | null;
  linkedCount?: number;
  summaryMode?: string | null;
  riskRating?: string | null;
};

type MarkdownToken = {
  type?: string;
  text?: string;
  raw?: string;
  tokens?: MarkdownToken[];
  items?: MarkdownToken[];
  header?: MarkdownToken[];
  rows?: MarkdownToken[];
  cells?: MarkdownToken[];
  depth?: number;
  href?: string;
  ordered?: boolean;
};

type SmartSegment =
  | { kind: "text"; value: string }
  | { kind: "badge"; value: string }
  | { kind: "cvss"; value: string; score: number };

type RenderState = {
  currentH2: string;
  h2Counter: number;
  inReferencesSection: boolean;
  refCounter: number;
  nextParagraphIsCallout: boolean;
  nextParagraphIsDisclaimer: boolean;
};

const C = {
  pageBg: "#e8eef5",
  panel: "#ffffff",
  panelBorder: "#c5d3e3",
  headerBand: "#152a47",
  headerBandEdge: "#1e3a5f",
  headerText: "#ffffff",
  headerSub: "#94a3b8",
  brandAccent: "#0891b2",
  title: "#0f2744",
  heading: "#1e4976",
  subheading: "#334155",
  body: "#334155",
  muted: "#64748b",
  accent: "#0e7490",
  rule: "#cbd5e1",
  sectionBg: "#f0f9ff",
  sectionBar: "#0891b2",
  sectionBorder: "#bae6fd",
  calloutBg: "#f8fafc",
  calloutBorder: "#0e7490",
  codeBg: "#f1f5f9",
  codeText: "#1e293b",
  codeBorder: "#cbd5e1",
  link: "#0369a1",
  footerBand: "#152a47",
  footerText: "#cbd5e1",
  intelBadgeBg: "#dbeafe",
  intelBadgeText: "#1e40af",
  cvssAmber: "#b45309",
  cvssRed: "#b91c1c",
  disclaimerBg: "#fffbeb",
  disclaimerBorder: "#d97706",
  disclaimerText: "#78350f",
  tableHeaderBg: "#e2e8f0",
  tableBorder: "#94a3b8",
  nestedBullet: "#94a3b8",
  watermark: "#cbd5e1",
  pillBg: "#f1f5f9",
  pillBorder: "#cbd5e1",
  pillText: "#475569",
};

const PAGE = {
  margin: 48,
  headerBandH: 68,
  contBandH: 36,
  footerH: 44,
};

const SMART_SPLIT_RE =
  /(\bCVE-\d{4}-\d{4,}\b|\bGHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b|\bCVSS\s+\d+(?:\.\d+)?\b|\b\d{1,3}(?:\.\d{1,3}){3}\[\.\]\d{1,3}\b|\b\d{1,3}(?:\[\.\]\d{1,3}){3}\[\.\]\d{1,3}\b)/gi;

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function flattenInlineTokens(tokens: MarkdownToken[] | undefined): MarkdownToken[] {
  if (!tokens?.length) return [];
  const out: MarkdownToken[] = [];
  for (const tok of tokens) {
    if (tok.type === "text" && tok.tokens?.length) {
      out.push(...flattenInlineTokens(tok.tokens));
    } else if (tok.type === "paragraph" && tok.tokens?.length) {
      out.push(...flattenInlineTokens(tok.tokens));
    } else {
      out.push(tok);
    }
  }
  return out;
}

function inlinePlainText(tokens: MarkdownToken[] | undefined): string {
  return flattenInlineTokens(tokens)
    .map((tok) => {
      if (tok.type === "text") return safeText(tok.text);
      if (tok.type === "codespan") return safeText(tok.text);
      if (tok.type === "escape") return safeText(tok.text);
      if (tok.type === "br") return "\n";
      if (tok.type === "link") return inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
      if (tok.type === "strong" || tok.type === "em" || tok.type === "del") {
        return inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
      }
      if (tok.tokens?.length) return inlinePlainText(tok.tokens);
      return stripMarkdownSyntax(safeText(tok.text));
    })
    .join("");
}

function blockPlainText(tok: MarkdownToken): string {
  if (tok.tokens?.length) {
    const plain = inlinePlainText(tok.tokens);
    if (plain.trim()) return plain;
  }
  return stripMarkdownSyntax(safeText(tok.text) || safeText(tok.raw));
}

function classifySmartSegment(match: string): SmartSegment {
  const upper = match.toUpperCase();
  if (upper.startsWith("CVSS")) {
    const score = parseFloat(match.replace(/[^\d.]/g, "")) || 0;
    return { kind: "cvss", value: match, score };
  }
  if (/^CVE-/i.test(match) || /^GHSA-/i.test(match)) {
    return { kind: "badge", value: match };
  }
  return { kind: "badge", value: match };
}

function splitSmartText(text: string): SmartSegment[] {
  if (!text) return [];
  const segments: SmartSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(SMART_SPLIT_RE.source, SMART_SPLIT_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, m.index) });
    }
    segments.push(classifySmartSegment(m[0]));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return segments.length ? segments : [{ kind: "text", value: text }];
}

export function prepareMarkdownForPdf(
  markdown: string,
  meta: Pick<AdvisoryPdfMeta, "classification">
): string {
  let text = markdown.replace(/\r\n/g, "\n").trim();

  text = text.replace(/^\s*\*\*Classification:\*\*\s*\n[^\n#]+(?:\n|$)/im, "");
  text = text.replace(/^\s*\*\*Classification:\*\*\s*[^\n#]+(?:\n|$)/im, "");
  text = text.replace(/(#{1,3}\s*Executive Summary\s*\n+)\*\*Executive Summary:\*\*\s*\n/gi, "$1");
  text = text.replace(/(#{1,3}\s*Executive Summary\s*\n+)Executive Summary:\s*\n/gi, "$1");
  text = text.replace(/\*\*Executive Summary:\*\*\s*/gi, "");
  text = text.replace(/(^|\n)Executive Summary:\s+(?=[A-Z])/g, "$1");

  if (meta.classification) {
    const cls = meta.classification.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*${cls}\\s*$`, "gim"), "");
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function contentLeft(doc: PDFKit.PDFDocument) {
  return doc.page.margins.left;
}

function contentRight(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.right;
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return contentRight(doc) - contentLeft(doc);
}

function contentBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - doc.page.margins.bottom;
}

function extractH2Headings(tokens: MarkdownToken[]): string[] {
  return tokens
    .filter((t) => t.type === "heading" && (t.depth ?? 2) === 2)
    .map((t) => blockPlainText(t).trim())
    .filter(Boolean);
}

function isReferencesHeading(text: string): boolean {
  return /^(references|source articles)$/i.test(text.trim());
}

function formatThreatLabel(threatType?: string | null): string | null {
  if (!threatType) return null;
  return THREAT_TYPE_LABELS[threatType as ThreatType] ?? threatType;
}

function formatSummaryModeLabel(mode?: string | null): string | null {
  if (!mode) return null;
  return AI_SUMMARY_MODE_LABELS[mode as AISummaryMode] ?? mode;
}

function paintPageBackground(doc: PDFKit.PDFDocument, mode: "cover" | "continued") {
  const w = doc.page.width;
  const h = doc.page.height;

  doc.save();
  doc.rect(0, 0, w, h).fill(C.pageBg);

  const bandH = mode === "cover" ? PAGE.headerBandH : PAGE.contBandH;
  doc.rect(0, 0, w, bandH).fill(C.headerBand);
  doc.moveTo(0, bandH).lineTo(w, bandH).strokeColor(C.brandAccent).lineWidth(2).stroke();

  const panelTop = bandH + 10;
  const panelBottom = h - PAGE.footerH - 8;
  doc
    .roundedRect(PAGE.margin - 8, panelTop, w - (PAGE.margin - 8) * 2, panelBottom - panelTop, 6)
    .fillColor(C.panel)
    .fill()
    .strokeColor(C.panelBorder)
    .lineWidth(0.75)
    .stroke();

  doc.restore();
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.save();
  doc.roundedRect(x, y, 30, 30, 5).fillColor(C.headerBandEdge).fill();
  doc
    .moveTo(x + 9, y + 22)
    .lineTo(x + 15, y + 9)
    .lineTo(x + 21, y + 22)
    .closePath()
    .fillColor(C.brandAccent)
    .fill();
  doc.restore();

  doc.fillColor(C.headerText).font("Helvetica-Bold").fontSize(15).text("SecHub", x + 38, y + 3);
  doc
    .fillColor(C.headerSub)
    .font("Helvetica")
    .fontSize(7.5)
    .text("Powered by Bramhashiv AI", x + 38, y + 20);
}

function drawCoverTopBand(doc: PDFKit.PDFDocument, meta: AdvisoryPdfMeta) {
  const left = PAGE.margin;
  const right = doc.page.width - PAGE.margin;
  const dateStr = (meta.generatedAt ?? new Date()).toISOString().slice(0, 10);
  const docRef = meta.advisoryId ? `ADV-${meta.advisoryId.slice(0, 8).toUpperCase()}` : "ADV-DRAFT";

  drawLogo(doc, left, 18);

  doc
    .fillColor(C.headerSub)
    .font("Helvetica")
    .fontSize(7.5)
    .text("DOCUMENT REF", right - 160, 16, { width: 160, align: "right", lineBreak: false });

  doc
    .fillColor(C.headerText)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(docRef, right - 160, 26, { width: 160, align: "right", lineBreak: false });

  doc
    .fillColor(C.brandAccent)
    .font("Helvetica")
    .fontSize(8)
    .text(dateStr, right - 160, 40, { width: 160, align: "right", lineBreak: false });

  doc
    .fillColor(C.headerSub)
    .font("Helvetica")
    .fontSize(7.5)
    .text("SECURITY ADVISORY", right - 160, 52, { width: 160, align: "right", lineBreak: false });
}

function drawClassificationBanner(doc: PDFKit.PDFDocument, classification: string) {
  const colors = getTlpBannerColors(classification || "TLP:AMBER");
  const x = contentLeft(doc);
  const w = contentWidth(doc);
  const y = doc.y;
  const h = 26;

  doc
    .save()
    .fillColor(colors.bg)
    .roundedRect(x, y, w, h, 3)
    .fill()
    .strokeColor(colors.border)
    .lineWidth(1)
    .stroke()
    .restore();

  doc
    .fillColor(colors.text)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(classification.toUpperCase(), x, y + 8, { width: w, align: "center", lineBreak: false });

  doc.y = y + h + 12;
}

function drawPill(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  maxW: number
): number {
  doc.font("Helvetica-Bold").fontSize(7.5);
  const textW = Math.min(doc.widthOfString(label), maxW - 16);
  const pillW = textW + 16;
  const pillH = 20;

  doc
    .save()
    .fillColor(C.pillBg)
    .roundedRect(x, y, pillW, pillH, 10)
    .fill()
    .strokeColor(C.pillBorder)
    .lineWidth(0.5)
    .stroke()
    .restore();

  doc
    .fillColor(C.pillText)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(label, x + 8, y + 6, { width: pillW - 16, lineBreak: false });

  return pillW;
}

function drawBadgeRow(doc: PDFKit.PDFDocument, meta: AdvisoryPdfMeta) {
  const pills: string[] = [];
  if (meta.templateName) pills.push(meta.templateName);
  const threat = formatThreatLabel(meta.threatType);
  if (threat) pills.push(threat);
  if (meta.linkedCount != null && meta.linkedCount > 0) {
    pills.push(`${meta.linkedCount} source${meta.linkedCount === 1 ? "" : "s"} merged`);
  }
  const summary = formatSummaryModeLabel(meta.summaryMode);
  if (summary) pills.push(summary);
  if (meta.status) pills.push(String(meta.status).toUpperCase());

  if (!pills.length) return;

  const x = contentLeft(doc);
  const maxRight = contentRight(doc);
  let cx = x;
  const y = doc.y;
  const gap = 6;
  const rowH = 24;

  for (const pill of pills) {
    doc.font("Helvetica-Bold").fontSize(7.5);
    const estW = doc.widthOfString(pill) + 16;
    if (cx + estW > maxRight && cx > x) {
      cx = x;
      doc.y = y + rowH;
    }
    const pillW = drawPill(doc, cx, doc.y === y ? y : doc.y, pill, maxRight - cx);
    cx += pillW + gap;
  }

  doc.y = (doc.y === y ? y : doc.y) + rowH + 4;
}

function drawRiskRatingBadge(doc: PDFKit.PDFDocument, rating: string) {
  const colors = getRiskRatingColors(rating) ?? RISK_RATING_COLORS.Medium;
  const x = contentLeft(doc);
  const label = `RISK: ${rating.toUpperCase()}`;
  doc.font("Helvetica-Bold").fontSize(8);
  const w = doc.widthOfString(label) + 20;
  const y = doc.y;
  const h = 22;

  doc
    .save()
    .fillColor(colors.bg)
    .roundedRect(x, y, w, h, 4)
    .fill()
    .strokeColor(colors.border)
    .lineWidth(1)
    .stroke()
    .restore();

  doc
    .fillColor(colors.text)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(label, x + 10, y + 7, { lineBreak: false });

  doc.y = y + h + 10;
}

function drawMetadataChips(doc: PDFKit.PDFDocument, meta: AdvisoryPdfMeta) {
  const chips: { label: string; value: string }[] = [];
  if (meta.author) chips.push({ label: "Author", value: meta.author });
  if (meta.updatedAt) chips.push({ label: "Updated", value: meta.updatedAt.toISOString().slice(0, 10) });

  if (!chips.length) return;

  const x = contentLeft(doc);
  let cx = x;
  const y = doc.y;
  const gap = 8;

  for (const chip of chips) {
    doc.font("Helvetica").fontSize(7);
    const labelW = doc.widthOfString(chip.label.toUpperCase());
    doc.font("Helvetica-Bold").fontSize(8);
    const valueW = doc.widthOfString(chip.value);
    const chipW = Math.max(labelW, valueW) + 16;
    const chipH = 28;

    doc
      .save()
      .fillColor(C.sectionBg)
      .roundedRect(cx, y, chipW, chipH, 4)
      .fill()
      .strokeColor(C.sectionBorder)
      .lineWidth(0.5)
      .stroke()
      .restore();

    doc
      .fillColor(C.muted)
      .font("Helvetica")
      .fontSize(7)
      .text(chip.label.toUpperCase(), cx + 8, y + 5, { width: chipW - 16, lineBreak: false });

    doc
      .fillColor(C.heading)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(chip.value, cx + 8, y + 15, { width: chipW - 16, lineBreak: false });

    cx += chipW + gap;
  }

  doc.y = y + 36;
}

function drawTableOfContents(doc: PDFKit.PDFDocument, sections: string[]) {
  if (sections.length < 3) return;

  doc
    .fillColor(C.heading)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Table of Contents", contentLeft(doc), doc.y, { width: contentWidth(doc), lineGap: 2 });

  doc.moveDown(0.35);

  for (let i = 0; i < sections.length; i++) {
    const line = `${i + 1}. ${sections[i]}`;
    doc
      .fillColor(C.body)
      .font("Helvetica")
      .fontSize(9.5)
      .text(line, contentLeft(doc) + 8, doc.y, { width: contentWidth(doc) - 8, lineGap: 2 });
    doc.moveDown(0.15);
  }

  doc.moveDown(0.5);
}

function drawBrandedHeader(doc: PDFKit.PDFDocument, meta: AdvisoryPdfMeta, tocSections: string[]) {
  paintPageBackground(doc, "cover");
  drawCoverTopBand(doc, meta);

  doc.x = contentLeft(doc);
  doc.y = PAGE.headerBandH + 22;

  drawClassificationBanner(doc, meta.classification || "TLP:AMBER — INTERNAL USE ONLY");

  doc
    .fillColor(C.title)
    .font("Helvetica-Bold")
    .fontSize(19)
    .text(meta.title || "Security Advisory", contentLeft(doc), doc.y, {
      width: contentWidth(doc),
      lineGap: 2,
    });

  doc.moveDown(0.4);
  drawBadgeRow(doc, meta);

  if (meta.riskRating) {
    drawRiskRatingBadge(doc, meta.riskRating);
  }

  drawMetadataChips(doc, meta);

  doc
    .strokeColor(C.rule)
    .lineWidth(1)
    .moveTo(contentLeft(doc), doc.y)
    .lineTo(contentRight(doc), doc.y)
    .stroke();

  doc.moveDown(0.65);
  drawTableOfContents(doc, tocSections);
}

function drawContinuationHeader(doc: PDFKit.PDFDocument, meta: AdvisoryPdfMeta, currentSection: string) {
  paintPageBackground(doc, "continued");

  const title = meta.title || "Security Advisory";
  const truncated = title.length > 52 ? `${title.slice(0, 49)}…` : title;
  const breadcrumb = currentSection
    ? `${truncated} › ${currentSection.length > 40 ? `${currentSection.slice(0, 37)}…` : currentSection}`
    : truncated;

  doc
    .fillColor(C.headerSub)
    .font("Helvetica")
    .fontSize(7)
    .text("SecHub · Security Advisory", PAGE.margin, 10, { lineBreak: false });

  doc
    .fillColor(C.headerText)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(breadcrumb, PAGE.margin, 20, {
      width: doc.page.width - PAGE.margin * 2,
      lineBreak: false,
    });

  doc.x = contentLeft(doc);
  doc.y = PAGE.contBandH + 18;
}

function drawTlpWatermark(doc: PDFKit.PDFDocument, classification: string) {
  const w = doc.page.width;
  const h = doc.page.height;
  const label = classification.toUpperCase().replace(/\s+/g, " ");

  doc.save();
  doc.fillColor(C.watermark);
  doc.font("Helvetica-Bold").fontSize(52);
  doc.rotate(-35, { origin: [w / 2, h / 2] });
  doc.text(label, 0, h / 2 - 20, { width: w, align: "center", lineBreak: false });
  doc.restore();
}

function addPageFooters(doc: PDFKit.PDFDocument, meta: AdvisoryPdfMeta) {
  const generatedAt = (meta.generatedAt ?? new Date()).toISOString().replace("T", " ").slice(0, 19);
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const classification = (meta.classification || "TLP:AMBER").toUpperCase();
  const left = PAGE.margin;
  const rightMargin = PAGE.margin;

  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);

    const w = doc.page.width;
    const h = doc.page.height;
    const footerTop = h - PAGE.footerH;
    const pageNum = i - range.start + 1;
    const contentW = w - left - rightMargin;

    drawTlpWatermark(doc, classification);

    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.save();

    doc.rect(0, footerTop, w, PAGE.footerH).fill(C.footerBand);
    doc.moveTo(0, footerTop).lineTo(w, footerTop).strokeColor(C.brandAccent).lineWidth(1).stroke();

    const line1 = `SecHub · ${classification} · Generated ${generatedAt} UTC`;
    const line2 = "Distribution per organizational policy — do not forward externally";
    const pageLine = `Page ${pageNum} of ${totalPages}`;

    doc.fillColor(C.footerText).font("Helvetica").fontSize(7.5);
    doc.text(line1, left, footerTop + 8, { width: contentW * 0.72, lineBreak: false });
    doc.text(line2, left, footerTop + 20, { width: contentW * 0.72, lineBreak: false });

    doc
      .fillColor(C.brandAccent)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(pageLine, left, footerTop + 12, { width: contentW, align: "right", lineBreak: false });

    doc.restore();

    doc.page.margins.bottom = savedBottom;
    doc.x = left;
    doc.y = doc.page.margins.top;
  }
}

function ensureSpaceLocal(doc: PDFKit.PDFDocument, needed: number, addPage: () => void) {
  if (doc.y + needed > contentBottom(doc)) addPage();
}

function renderSmartText(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { color?: string; size?: number; w?: number; x?: number; continued?: boolean } = {}
) {
  const color = opts.color ?? C.body;
  const size = opts.size ?? 10.5;
  const w = opts.w ?? contentWidth(doc);
  const startX = opts.x ?? contentLeft(doc);
  const segments = splitSmartText(text);
  if (!segments.length) return;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const continued = opts.continued !== false && !isLast;

    if (seg.kind === "text") {
      if (!seg.value) continue;
      doc.fillColor(color).font("Helvetica").fontSize(size).text(seg.value, startX, doc.y, {
        continued,
        width: w,
        lineGap: 3,
      });
    } else if (seg.kind === "badge") {
      doc.font("Courier-Bold").fontSize(size - 0.5);
      const tw = doc.widthOfString(seg.value);
      const pad = 3;
      const bh = size + 1;
      const bx = doc.x;
      const by = doc.y;
      doc.save();
      doc.fillColor(C.intelBadgeBg).roundedRect(bx, by - 1, tw + pad * 2, bh, 2).fill();
      doc.restore();
      doc
        .fillColor(C.intelBadgeText)
        .font("Courier-Bold")
        .fontSize(size - 0.5)
        .text(seg.value, bx + pad, by, { continued, width: w, lineGap: 3 });
      doc.font("Helvetica").fontSize(size);
    } else if (seg.kind === "cvss") {
      const cvssColor = seg.score >= 9 ? C.cvssRed : seg.score >= 7 ? C.cvssAmber : color;
      doc
        .fillColor(cvssColor)
        .font("Helvetica-Bold")
        .fontSize(size)
        .text(seg.value, startX, doc.y, { continued, width: w, lineGap: 3 });
      doc.font("Helvetica");
    }
  }
}

function renderMarkdownTokens(
  doc: PDFKit.PDFDocument,
  markdown: string,
  meta: AdvisoryPdfMeta,
  state: RenderState
) {
  const tokens = marked.lexer(markdown ?? "") as MarkdownToken[];

  const addPage = () => {
    doc.addPage();
    drawContinuationHeader(doc, meta, state.currentH2);
  };

  const ensureSpace = (needed = 40) => ensureSpaceLocal(doc, needed, addPage);

  const estimateTextHeight = (text: string, w: number, size = 10.5) => {
    doc.font("Helvetica").fontSize(size);
    return doc.heightOfString(text, { width: w, lineGap: 4 });
  };

  const renderInline = (
    inlineTokens: MarkdownToken[] | undefined,
    opts: { color?: string; size?: number; w?: number; x?: number } = {}
  ) => {
    const color = opts.color ?? C.body;
    const size = opts.size ?? 10.5;
    const w = opts.w ?? contentWidth(doc);
    const startX = opts.x ?? contentLeft(doc);
    const flat = flattenInlineTokens(inlineTokens);
    if (!flat.length) return;

    for (let i = 0; i < flat.length; i++) {
      const tok = flat[i];
      const continued = i < flat.length - 1;

      switch (tok.type) {
        case "text": {
          const chunk = safeText(tok.text);
          if (!chunk) break;
          renderSmartText(doc, chunk, { color, size, w, x: startX, continued });
          break;
        }
        case "strong": {
          const chunk = inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
          if (!chunk) break;
          doc.fillColor(C.heading).font("Helvetica-Bold").fontSize(size).text(chunk, startX, doc.y, {
            continued,
            width: w,
            lineGap: 3,
          });
          doc.font("Helvetica");
          break;
        }
        case "em": {
          const chunk = inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
          if (!chunk) break;
          doc.fillColor(color).font("Helvetica-Oblique").fontSize(size).text(chunk, startX, doc.y, {
            continued,
            width: w,
            lineGap: 3,
          });
          doc.font("Helvetica");
          break;
        }
        case "codespan": {
          const code = safeText(tok.text);
          doc.fillColor(C.codeText).font("Courier-Bold").fontSize(size - 0.5);
          doc.text(code, startX, doc.y, { continued, width: w, lineGap: 3 });
          doc.font("Helvetica").fontSize(size);
          break;
        }
        case "link": {
          const label = inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
          doc.fillColor(C.link).font("Helvetica").fontSize(size);
          doc.text(label, startX, doc.y, { continued, width: w, lineGap: 3, underline: true });
          break;
        }
        case "br":
          doc.text("\n", startX, doc.y, { width: w, lineGap: 3 });
          break;
        default: {
          const fallback = stripMarkdownSyntax(safeText(tok.text) || safeText(tok.raw));
          if (fallback) {
            renderSmartText(doc, fallback, { color, size, w, x: startX, continued });
          }
        }
      }
    }
  };

  const isLabelLine = (tok: MarkdownToken) => {
    const flat = flattenInlineTokens(tok.tokens);
    if (flat.length === 1 && flat[0].type === "strong") return true;
    const text = blockPlainText(tok).trim();
    return /^[A-Za-z0-9][A-Za-z0-9 /&()-]{0,48}:$/.test(text);
  };

  const isDistributionNotesLabel = (text: string) => /^distribution notes:?$/i.test(text.replace(/:$/, ""));

  const renderLabel = (tok: MarkdownToken) => {
    const text = blockPlainText(tok).trim();
    if (!text) return;

    if (isDistributionNotesLabel(text)) {
      state.nextParagraphIsDisclaimer = true;
      return;
    }

    ensureSpace(22);
    const labelText = text.replace(/:$/, "").toUpperCase();
    doc
      .fillColor(C.accent)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(labelText, contentLeft(doc), doc.y, { width: contentWidth(doc), lineGap: 2, characterSpacing: 0.3 });
    doc.moveDown(0.35);
  };

  const renderDisclaimerBox = (bodyText: string, renderBody: () => void) => {
    const x = contentLeft(doc);
    const w = contentWidth(doc);
    const textH = estimateTextHeight(bodyText, w - 28);
    const boxH = textH + 24;
    ensureSpace(boxH + 8);

    const startY = doc.y;
    doc.save();
    doc.fillColor(C.disclaimerBg).roundedRect(x, startY, w, boxH, 5).fill();
    doc.rect(x, startY, 4, boxH).fillColor(C.disclaimerBorder).fill();
    doc.strokeColor(C.disclaimerBorder).lineWidth(0.75).roundedRect(x, startY, w, boxH, 5).stroke();
    doc.restore();

    doc
      .fillColor(C.disclaimerText)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("DISTRIBUTION NOTES", x + 14, startY + 8, { lineBreak: false });

    doc.y = startY + 20;
    doc.x = x + 14;
    renderBody();
    doc.y = startY + boxH + 10;
    state.nextParagraphIsDisclaimer = false;
  };

  const extractRefEntry = (item: MarkdownToken): { title: string; url: string | null } => {
    const flat = flattenInlineTokens(item.tokens);
    const linkTok = flat.find((t) => t.type === "link");
    if (linkTok) {
      const title = inlinePlainText(linkTok.tokens) || stripMarkdownSyntax(safeText(linkTok.text));
      const url = safeText(linkTok.href) || null;
      return { title: title || blockPlainText(item), url };
    }
    const plain = blockPlainText(item).trim();
    const urlMatch = plain.match(/https?:\/\/[^\s)]+/);
    if (urlMatch) {
      return { title: plain.replace(urlMatch[0], "").replace(/[—–-]\s*$/, "").trim() || urlMatch[0], url: urlMatch[0] };
    }
    return { title: plain, url: null };
  };

  const renderBibliographyItem = (item: MarkdownToken) => {
    state.refCounter += 1;
    const { title, url } = extractRefEntry(item);
    const x = contentLeft(doc);
    const numX = x;
    const textX = x + 22;
    const w = contentRight(doc) - textX;
    const titleH = estimateTextHeight(title, w, 10);
    const urlH = url ? estimateTextHeight(url, w, 8) + 4 : 0;
    ensureSpace(titleH + urlH + 10);

    const startY = doc.y;
    doc
      .fillColor(C.accent)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`[${state.refCounter}]`, numX, startY, { lineBreak: false });

    doc
      .fillColor(C.body)
      .font("Helvetica")
      .fontSize(10)
      .text(title, textX, startY, { width: w, lineGap: 3 });

    if (url) {
      doc
        .fillColor(C.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(url, textX, doc.y + 2, { width: w, lineGap: 2 });
    }

    doc.moveDown(0.5);
  };

  const renderParagraph = (tok: MarkdownToken) => {
    if (isLabelLine(tok)) {
      renderLabel(tok);
      return;
    }

    const bodyText = blockPlainText(tok);
    const renderBody = () => {
      if (tok.tokens?.length) {
        renderInline(tok.tokens);
      } else if (bodyText.trim()) {
        renderSmartText(doc, bodyText, { w: contentWidth(doc) });
      }
    };

    if (state.nextParagraphIsDisclaimer) {
      renderDisclaimerBox(bodyText, renderBody);
      return;
    }

    if (state.inReferencesSection && bodyText.trim()) {
      renderBibliographyItem(tok);
      return;
    }

    if (state.nextParagraphIsCallout) {
      state.nextParagraphIsCallout = false;
      const x = contentLeft(doc);
      const w = contentWidth(doc);
      const textH = estimateTextHeight(bodyText, w - 28);
      const boxH = textH + 24;
      ensureSpace(boxH + 8);

      const startY = doc.y;
      doc.save();
      doc.fillColor(C.calloutBg).roundedRect(x, startY, w, boxH, 5).fill();
      doc.rect(x, startY, 4, boxH).fillColor(C.sectionBar).fill();
      doc.strokeColor(C.calloutBorder).lineWidth(0.75).roundedRect(x, startY, w, boxH, 5).stroke();
      doc.restore();

      doc.y = startY + 12;
      doc.x = x + 14;
      renderBody();
      doc.y = startY + boxH + 10;
      return;
    }

    ensureSpace(estimateTextHeight(bodyText, contentWidth(doc)) + 8);
    renderBody();
    doc.moveDown(0.55);
  };

  const heading = (tok: MarkdownToken) => {
    const level = tok.depth ?? 2;
    const rawText = blockPlainText(tok).trim();
    if (!rawText) return;

    if (level <= 2) {
      state.h2Counter += 1;
      const numbered = `${state.h2Counter}. ${rawText}`;
      state.currentH2 = rawText;
      state.inReferencesSection = isReferencesHeading(rawText);
      state.refCounter = 0;

      state.nextParagraphIsCallout = /executive summary/i.test(rawText);

      const x = contentLeft(doc);
      const w = contentWidth(doc);
      const size = level === 1 ? 14 : 12;
      doc.font("Helvetica-Bold").fontSize(size);
      const textH = doc.heightOfString(numbered, { width: w - 24, lineGap: 2 });
      const barH = textH + 14;

      ensureSpace(barH + 12);

      const y = doc.y;
      doc.save();
      doc.fillColor(C.sectionBg).rect(x, y, w, barH).fill();
      doc.rect(x, y, 4, barH).fillColor(C.sectionBar).fill();
      doc.restore();

      doc
        .fillColor(C.heading)
        .font("Helvetica-Bold")
        .fontSize(size)
        .text(numbered, x + 12, y + 7, { width: w - 24, lineGap: 2 });

      doc.y = y + barH + 10;
    } else {
      const x = contentLeft(doc);
      const w = contentWidth(doc);
      doc.font("Helvetica-Bold").fontSize(11);
      const textH = doc.heightOfString(rawText, { width: w - 20, lineGap: 2 });
      const cardH = textH + 12;
      ensureSpace(cardH + 12);

      const y = doc.y;
      doc.save();
      doc.fillColor("#f8fafc").roundedRect(x, y, w, cardH, 3).fill();
      doc.rect(x, y, 3, cardH).fillColor(C.sectionBar).fill();
      doc.strokeColor(C.sectionBorder).lineWidth(0.5).roundedRect(x, y, w, cardH, 3).stroke();
      doc.restore();

      doc
        .fillColor(C.subheading)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(rawText, x + 12, y + 6, { width: w - 20, lineGap: 2 });

      doc.y = y + cardH + 8;
    }
  };

  const renderListItem = (
    item: MarkdownToken,
    indent: number,
    ordered: boolean,
    index: number,
    nested: boolean
  ) => {
    if (state.inReferencesSection && indent === 0) {
      renderBibliographyItem(item);
      return;
    }

    const bulletX = contentLeft(doc) + indent;
    const textX = bulletX + 16;
    const w = contentRight(doc) - textX;
    const itemText = blockPlainText(item);
    const itemH = estimateTextHeight(itemText, w) + 6;

    ensureSpace(itemH + 4);

    const startY = doc.y;
    const marker = ordered ? `${index + 1}.` : "\u2022";
    const bulletColor = nested ? C.nestedBullet : C.accent;

    doc
      .fillColor(bulletColor)
      .font(nested ? "Helvetica" : "Helvetica-Bold")
      .fontSize(nested ? 9.5 : 10.5)
      .text(marker, bulletX, startY, { lineBreak: false });

    doc.x = textX;
    doc.y = startY;

    const nestedList = item.tokens?.find((t) => t.type === "list");
    const inlineSource = item.tokens?.filter((t) => t.type !== "list") ?? [];

    if (inlineSource.length) {
      renderInline(flattenInlineTokens(inlineSource), { w, x: textX });
    } else if (itemText) {
      renderSmartText(doc, itemText, { w, x: textX });
    }

    doc.moveDown(0.45);

    if (nestedList?.items?.length) {
      bullet(nestedList.items, indent + 20, !!nestedList.ordered, true);
    }
  };

  const bullet = (items: MarkdownToken[], indent = 0, ordered = false, nested = false) => {
    if (!items.length) return;
    ensureSpace(16);
    doc.moveDown(0.15);

    for (let i = 0; i < items.length; i++) {
      renderListItem(items[i], indent, ordered, i, nested);
    }

    doc.moveDown(0.25);
  };

  const getTableCells = (row: MarkdownToken): MarkdownToken[] => {
    if (row.cells?.length) return row.cells;
    if (row.tokens?.length) return row.tokens.filter((t) => t.type === "td" || t.type === "th");
    return [];
  };

  const renderTable = (tok: MarkdownToken) => {
    const headerRow = tok.header?.[0];
    const headerCells = headerRow ? getTableCells(headerRow) : [];
    const bodyRows = tok.rows ?? [];
    if (!headerCells.length && !bodyRows.length) return;

    const x = contentLeft(doc);
    const w = contentWidth(doc);
    const colCount = Math.max(headerCells.length, bodyRows[0] ? getTableCells(bodyRows[0]).length : 0);
    if (colCount === 0) return;

    const colW = w / colCount;
    const rowH = 22;
    const totalRows = 1 + bodyRows.length;
    ensureSpace(totalRows * rowH + 12);

    const startY = doc.y;

    for (let c = 0; c < colCount; c++) {
      const cell = headerCells[c];
      const cellText = cell ? blockPlainText(cell) : "";
      const cx = x + c * colW;
      doc.save();
      doc.fillColor(C.tableHeaderBg).rect(cx, startY, colW, rowH).fill();
      doc.strokeColor(C.tableBorder).lineWidth(0.5).rect(cx, startY, colW, rowH).stroke();
      doc.restore();
      doc
        .fillColor(C.heading)
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .text(cellText, cx + 4, startY + 6, { width: colW - 8, lineBreak: false });
    }

    for (let r = 0; r < bodyRows.length; r++) {
      const cells = getTableCells(bodyRows[r]);
      const ry = startY + rowH * (r + 1);
      for (let c = 0; c < colCount; c++) {
        const cell = cells[c];
        const cellText = cell ? blockPlainText(cell) : "";
        const cx = x + c * colW;
        doc.save();
        doc.fillColor(C.panel).rect(cx, ry, colW, rowH).fill();
        doc.strokeColor(C.tableBorder).lineWidth(0.5).rect(cx, ry, colW, rowH).stroke();
        doc.restore();
        doc
          .fillColor(C.body)
          .font("Helvetica")
          .fontSize(8.5)
          .text(cellText, cx + 4, ry + 6, { width: colW - 8, lineBreak: false });
      }
    }

    doc.y = startY + rowH * totalRows + 10;
  };

  const codeBlock = (code: string) => {
    const x = contentLeft(doc);
    const w = contentWidth(doc);
    const cleanCode = code.replace(/\t/g, "  ");
    const padding = 12;

    doc.font("Courier").fontSize(9);
    const textHeight = doc.heightOfString(cleanCode, { width: w - padding * 2, lineGap: 2 });
    const boxHeight = textHeight + padding * 2 + 10;

    ensureSpace(boxHeight + 8);

    const startY = doc.y;
    doc
      .save()
      .fillColor(C.codeBg)
      .strokeColor(C.codeBorder)
      .lineWidth(0.75)
      .roundedRect(x, startY, w, boxHeight, 5)
      .fillAndStroke()
      .restore();

    doc
      .fillColor(C.muted)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text("CODE / CONFIG", x + padding, startY + 6, { lineBreak: false });

    doc
      .fillColor(C.codeText)
      .font("Courier")
      .fontSize(9)
      .text(cleanCode, x + padding, startY + padding + 8, {
        width: w - padding * 2,
        lineGap: 2,
      });

    doc.y = startY + boxHeight + 10;
  };

  const quote = (tok: MarkdownToken) => {
    const x = contentLeft(doc);
    const w = contentWidth(doc);
    const text = blockPlainText(tok).trim();
    const padding = 14;

    doc.font("Helvetica-Oblique").fontSize(10);
    const textHeight = doc.heightOfString(text, { width: w - padding * 2, lineGap: 4 });
    const boxHeight = textHeight + padding;

    ensureSpace(boxHeight + 8);

    const startY = doc.y;
    doc.save().fillColor(C.sectionBg).roundedRect(x, startY, w, boxHeight, 4).fill().restore();
    doc.rect(x, startY, 4, boxHeight).fillColor(C.sectionBar).fill();

    doc
      .fillColor(C.subheading)
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text(text, x + padding, startY + padding / 2, {
        width: w - padding * 2,
        lineGap: 4,
      });

    doc.y = startY + boxHeight + 10;
  };

  for (const tok of tokens) {
    if (tok.type === "space") continue;

    if (tok.type === "heading") {
      heading(tok);
      continue;
    }

    if (tok.type === "paragraph") {
      renderParagraph(tok);
      continue;
    }

    if (tok.type === "blockquote") {
      quote(tok);
      continue;
    }

    if (tok.type === "list") {
      bullet(tok.items ?? [], 0, !!tok.ordered, false);
      continue;
    }

    if (tok.type === "code") {
      codeBlock(safeText(tok.text) || safeText(tok.raw));
      continue;
    }

    if (tok.type === "table") {
      renderTable(tok);
      continue;
    }

    if (tok.type === "hr") {
      ensureSpace(16);
      doc
        .strokeColor(C.rule)
        .lineWidth(0.75)
        .moveTo(contentLeft(doc), doc.y)
        .lineTo(contentRight(doc), doc.y)
        .stroke();
      doc.moveDown(0.8);
      continue;
    }

    const text = blockPlainText(tok);
    if (text) {
      ensureSpace(estimateTextHeight(text, contentWidth(doc)) + 8);
      renderSmartText(doc, text, { w: contentWidth(doc) });
      doc.moveDown(0.5);
    }
  }
}

export async function renderAdvisoryPdf(args: {
  meta: AdvisoryPdfMeta;
  markdown: string;
}): Promise<Buffer> {
  const generatedAt = args.meta.generatedAt ?? new Date();
  const meta: AdvisoryPdfMeta = { ...args.meta, generatedAt };
  const markdown = prepareMarkdownForPdf(args.markdown, meta);
  const lexerTokens = marked.lexer(markdown ?? "") as MarkdownToken[];
  const tocSections = extractH2Headings(lexerTokens);

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: PAGE.margin,
      bottom: PAGE.footerH,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: meta.title,
      Producer: "SecHub",
      Creator: "SecHub / Bramhashiv AI",
    },
  });

  const bufPromise = collectBuffer(doc);

  const renderState: RenderState = {
    currentH2: "",
    h2Counter: 0,
    inReferencesSection: false,
    refCounter: 0,
    nextParagraphIsCallout: false,
    nextParagraphIsDisclaimer: false,
  };

  drawBrandedHeader(doc, meta, tocSections);
  renderMarkdownTokens(doc, markdown, meta, renderState);
  addPageFooters(doc, meta);

  doc.end();
  return bufPromise;
}

// Re-export for consumers that reference risk colors from PDF module
export { RISK_RATING_COLORS };
