import PDFDocument from "pdfkit";
import { marked } from "marked";
import type PDFKit from "pdfkit";

type Meta = {
  title: string;
  status?: string | null;
  updatedAt?: Date | null;
  author?: string | null;
  classification?: string | null;
  generatedAt?: Date;
};

type MarkdownToken = {
  type?: string;
  text?: string;
  raw?: string;
  tokens?: MarkdownToken[];
  items?: MarkdownToken[];
  depth?: number;
  href?: string;
  ordered?: boolean;
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
  bannerBg: "#fef3c7",
  bannerBorder: "#f59e0b",
  bannerText: "#92400e",
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
};

const PAGE = {
  margin: 48,
  headerBandH: 68,
  contBandH: 36,
  footerH: 44,
};

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

export function prepareMarkdownForPdf(markdown: string, meta: Pick<Meta, "classification">): string {
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

function drawCoverTopBand(doc: PDFKit.PDFDocument, meta: Meta) {
  const left = PAGE.margin;
  const right = doc.page.width - PAGE.margin;
  const dateStr = (meta.generatedAt ?? new Date()).toISOString().slice(0, 10);

  drawLogo(doc, left, 18);

  doc
    .fillColor(C.headerSub)
    .font("Helvetica")
    .fontSize(7.5)
    .text("DOCUMENT TYPE", right - 160, 20, { width: 160, align: "right", lineBreak: false });

  doc
    .fillColor(C.headerText)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("SECURITY ADVISORY", right - 160, 30, { width: 160, align: "right", lineBreak: false });

  doc
    .fillColor(C.brandAccent)
    .font("Helvetica")
    .fontSize(8)
    .text(dateStr, right - 160, 44, { width: 160, align: "right", lineBreak: false });
}

function drawClassificationBanner(doc: PDFKit.PDFDocument, classification: string) {
  const x = contentLeft(doc);
  const w = contentWidth(doc);
  const y = doc.y;
  const h = 26;

  doc
    .save()
    .fillColor(C.bannerBg)
    .roundedRect(x, y, w, h, 3)
    .fill()
    .strokeColor(C.bannerBorder)
    .lineWidth(1)
    .stroke()
    .restore();

  doc
    .fillColor(C.bannerText)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(classification.toUpperCase(), x, y + 8, { width: w, align: "center", lineBreak: false });

  doc.y = y + h + 14;
}

function drawMetadataRow(doc: PDFKit.PDFDocument, meta: Meta) {
  const chips: { label: string; value: string }[] = [];
  if (meta.status) chips.push({ label: "Status", value: String(meta.status).toUpperCase() });
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

function drawBrandedHeader(doc: PDFKit.PDFDocument, meta: Meta) {
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

  doc.moveDown(0.45);
  drawMetadataRow(doc, meta);

  doc
    .strokeColor(C.rule)
    .lineWidth(1)
    .moveTo(contentLeft(doc), doc.y)
    .lineTo(contentRight(doc), doc.y)
    .stroke();

  doc.moveDown(0.85);
}

function drawContinuationHeader(doc: PDFKit.PDFDocument, meta: Meta) {
  paintPageBackground(doc, "continued");

  const title = meta.title || "Security Advisory";
  const truncated = title.length > 72 ? `${title.slice(0, 69)}…` : title;

  doc
    .fillColor(C.headerSub)
    .font("Helvetica")
    .fontSize(7)
    .text("SecHub · Security Advisory", PAGE.margin, 10, { lineBreak: false });

  doc
    .fillColor(C.headerText)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(truncated, PAGE.margin, 20, {
      width: doc.page.width - PAGE.margin * 2,
      lineBreak: false,
    });

  doc.x = contentLeft(doc);
  doc.y = PAGE.contBandH + 18;
}

function addPageFooters(doc: PDFKit.PDFDocument, meta: Meta) {
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

    // Footer sits in the bottom margin band — temporarily allow writing there.
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

function renderMarkdownTokens(doc: PDFKit.PDFDocument, markdown: string, meta: Meta) {
  const tokens = marked.lexer(markdown ?? "") as MarkdownToken[];
  let nextParagraphIsCallout = false;

  const addPage = () => {
    doc.addPage();
    drawContinuationHeader(doc, meta);
  };

  const ensureSpace = (needed = 40) => {
    if (doc.y + needed > contentBottom(doc)) addPage();
  };

  const estimateTextHeight = (text: string, w: number, size = 10.5, lineGap = 4) => {
    doc.font("Helvetica").fontSize(size);
    return doc.heightOfString(text, { width: w, lineGap });
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
          doc.fillColor(color).font("Helvetica").fontSize(size).text(chunk, startX, doc.y, {
            continued,
            width: w,
            lineGap: 3,
          });
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
            doc.fillColor(color).font("Helvetica").fontSize(size).text(fallback, startX, doc.y, {
              continued,
              width: w,
              lineGap: 3,
            });
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

  const renderLabel = (tok: MarkdownToken) => {
    const text = blockPlainText(tok).trim();
    if (!text) return;
    ensureSpace(22);
    doc
      .fillColor(C.accent)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(text, contentLeft(doc), doc.y, { width: contentWidth(doc), lineGap: 2 });
    doc.moveDown(0.35);
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
        doc.fillColor(C.body).font("Helvetica").fontSize(10.5).text(bodyText, {
          width: contentWidth(doc),
          lineGap: 4,
        });
      }
    };

    if (nextParagraphIsCallout) {
      nextParagraphIsCallout = false;
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
    const text = blockPlainText(tok).trim();
    if (!text) return;

    nextParagraphIsCallout = /executive summary/i.test(text);

    if (level <= 2) {
      const x = contentLeft(doc);
      const w = contentWidth(doc);
      const size = level === 1 ? 14 : 12;
      doc.font("Helvetica-Bold").fontSize(size);
      const textH = doc.heightOfString(text, { width: w - 24, lineGap: 2 });
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
        .text(text, x + 12, y + 7, { width: w - 24, lineGap: 2 });

      doc.y = y + barH + 10;
    } else {
      ensureSpace(28);
      doc
        .fillColor(C.subheading)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(text, contentLeft(doc), doc.y, { width: contentWidth(doc), lineGap: 2 });
      doc.moveDown(0.4);
    }
  };

  const renderListItem = (item: MarkdownToken, indent: number, ordered: boolean, index: number) => {
    const bulletX = contentLeft(doc) + indent;
    const textX = bulletX + 16;
    const w = contentRight(doc) - textX;
    const itemText = blockPlainText(item);
    const itemH = estimateTextHeight(itemText, w) + 6;

    ensureSpace(itemH + 4);

    const startY = doc.y;
    const marker = ordered ? `${index + 1}.` : "\u2022";

    doc
      .fillColor(C.accent)
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text(marker, bulletX, startY, { lineBreak: false });

    doc.x = textX;
    doc.y = startY;

    const nestedList = item.tokens?.find((t) => t.type === "list");
    const inlineSource = item.tokens?.filter((t) => t.type !== "list") ?? [];

    if (inlineSource.length) {
      renderInline(flattenInlineTokens(inlineSource), { w, x: textX });
    } else if (itemText) {
      doc.fillColor(C.body).font("Helvetica").fontSize(10.5).text(itemText, { width: w, lineGap: 4 });
    }

    doc.moveDown(0.45);

    if (nestedList?.items?.length) {
      bullet(nestedList.items, indent + 18, !!nestedList.ordered);
    }
  };

  const bullet = (items: MarkdownToken[], indent = 0, ordered = false) => {
    if (!items.length) return;
    ensureSpace(16);
    doc.moveDown(0.15);

    for (let i = 0; i < items.length; i++) {
      renderListItem(items[i], indent, ordered, i);
    }

    doc.moveDown(0.25);
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
      bullet(tok.items ?? [], 0, !!tok.ordered);
      continue;
    }

    if (tok.type === "code") {
      codeBlock(safeText(tok.text) || safeText(tok.raw));
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
      doc.fillColor(C.body).font("Helvetica").fontSize(10.5).text(text, { width: contentWidth(doc), lineGap: 4 });
      doc.moveDown(0.5);
    }
  }
}

export async function renderAdvisoryPdf(args: {
  meta: Meta;
  markdown: string;
}): Promise<Buffer> {
  const generatedAt = args.meta.generatedAt ?? new Date();
  const markdown = prepareMarkdownForPdf(args.markdown, args.meta);

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
      Title: args.meta.title,
      Producer: "SecHub",
      Creator: "SecHub / Bramhashiv AI",
    },
  });

  const bufPromise = collectBuffer(doc);

  drawBrandedHeader(doc, { ...args.meta, generatedAt });
  renderMarkdownTokens(doc, markdown, args.meta);
  addPageFooters(doc, { ...args.meta, generatedAt });

  doc.end();
  return bufPromise;
}
