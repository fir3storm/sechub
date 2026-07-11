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

const COLORS = {
  title: "#1a365d",
  heading: "#2c5282",
  subheading: "#4a5568",
  body: "#2d3748",
  muted: "#718096",
  accent: "#2b6cb0",
  rule: "#cbd5e0",
  bannerBg: "#fffbeb",
  bannerBorder: "#f6e05e",
  bannerText: "#744210",
  codeBg: "#f7fafc",
  codeText: "#2d3748",
  codeBorder: "#e2e8f0",
  brand: "#1e3a5f",
  brandAccent: "#3182ce",
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

/** Flatten marked's wrapper text tokens so inline strong/em render correctly in lists. */
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

/** Remove form-field noise already shown in the PDF header. */
export function prepareMarkdownForPdf(markdown: string, meta: Pick<Meta, "classification">): string {
  let text = markdown.replace(/\r\n/g, "\n").trim();

  text = text.replace(/^\s*\*\*Classification:\*\*\s*\n[^\n#]+(?:\n|$)/im, "");
  text = text.replace(/^\s*\*\*Classification:\*\*\s*[^\n#]+(?:\n|$)/im, "");
  text = text.replace(/(#{1,3}\s*Executive Summary\s*\n+)\*\*Executive Summary:\*\*\s*\n/gi, "$1");
  text = text.replace(/(#{1,3}\s*Executive Summary\s*\n+)Executive Summary:\s*\n/gi, "$1");

  if (meta.classification) {
    const cls = meta.classification.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*${cls}\\s*$`, "gim"), "");
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.save();
  doc.roundedRect(x, y, 28, 28, 4).fillColor(COLORS.brand).fill();
  doc
    .moveTo(x + 8, y + 20)
    .lineTo(x + 14, y + 8)
    .lineTo(x + 20, y + 20)
    .closePath()
    .fillColor(COLORS.brandAccent)
    .fill();
  doc.restore();

  doc.fillColor(COLORS.brand).font("Helvetica-Bold").fontSize(14).text("SecHub", x + 36, y + 2);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text("Powered by Bramhashiv AI", x + 36, y + 18);
}

function drawClassificationBanner(doc: PDFKit.PDFDocument, classification: string) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;

  doc
    .save()
    .fillColor(COLORS.bannerBg)
    .rect(x, y, width, 24)
    .fill()
    .strokeColor(COLORS.bannerBorder)
    .lineWidth(0.75)
    .rect(x, y, width, 24)
    .stroke()
    .restore();

  doc
    .fillColor(COLORS.bannerText)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(classification.toUpperCase(), x, y + 7, { width, align: "center", lineBreak: false });

  doc.y = y + 32;
}

function drawBrandedHeader(doc: PDFKit.PDFDocument, meta: Meta) {
  drawLogo(doc, doc.page.margins.left, doc.y);
  doc.y += 36;

  drawClassificationBanner(doc, meta.classification || "TLP:AMBER — INTERNAL USE ONLY");

  doc
    .fillColor(COLORS.title)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(meta.title || "Security Advisory", { align: "left" });

  doc.moveDown(0.35);

  const line: string[] = [];
  if (meta.status) line.push(String(meta.status).toUpperCase());
  if (meta.author) line.push(meta.author);
  if (meta.updatedAt) line.push(meta.updatedAt.toISOString().slice(0, 10));

  if (line.length) {
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(9.5)
      .text(line.join("  ·  "), { align: "left" });
  }

  doc.moveDown(0.8);
  doc
    .strokeColor(COLORS.rule)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.9);
}

function drawContinuationHeader(doc: PDFKit.PDFDocument, meta: Meta) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(meta.title || "Security Advisory", left, doc.page.margins.top - 28, {
      width: right - left,
      align: "left",
      lineBreak: false,
    });

  doc
    .strokeColor(COLORS.rule)
    .lineWidth(0.5)
    .moveTo(left, doc.page.margins.top - 12)
    .lineTo(right, doc.page.margins.top - 12)
    .stroke();
}

function addPageFooters(doc: PDFKit.PDFDocument, meta: Meta) {
  const generatedAt = (meta.generatedAt ?? new Date()).toISOString().replace("T", " ").slice(0, 19);
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const footerY = doc.page.height - 36;

  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const pageNum = i - range.start + 1;

    doc.save();

    doc
      .strokeColor(COLORS.rule)
      .lineWidth(0.5)
      .moveTo(left, footerY - 10)
      .lineTo(right, footerY - 10)
      .stroke();

    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8);

    doc.text(`SecHub Security Advisory · Generated ${generatedAt} UTC`, left, footerY, {
      width: width * 0.72,
      align: "left",
      lineBreak: false,
      height: 10,
    });

    doc.text(`Page ${pageNum} of ${totalPages}`, left, footerY, {
      width,
      align: "right",
      lineBreak: false,
      height: 10,
    });

    doc.restore();
  }
}

function renderMarkdownTokens(doc: PDFKit.PDFDocument, markdown: string, meta: Meta) {
  const tokens = marked.lexer(markdown ?? "") as MarkdownToken[];

  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 8;
  const contentWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const addPage = () => {
    doc.addPage();
    drawContinuationHeader(doc, meta);
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  };

  const ensureSpace = (needed = 40) => {
    if (doc.y + needed > bottomLimit()) addPage();
  };

  const renderInline = (
    inlineTokens: MarkdownToken[] | undefined,
    opts: { color?: string; size?: number; width?: number; x?: number } = {}
  ) => {
    const color = opts.color ?? COLORS.body;
    const size = opts.size ?? 10.5;
    const width = opts.width ?? contentWidth();
    const startX = opts.x ?? doc.page.margins.left;
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
            width,
            lineGap: 2,
          });
          break;
        }
        case "strong": {
          const chunk = inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
          if (!chunk) break;
          doc.fillColor(color).font("Helvetica-Bold").fontSize(size).text(chunk, startX, doc.y, {
            continued,
            width,
            lineGap: 2,
          });
          doc.font("Helvetica");
          break;
        }
        case "em": {
          const chunk = inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
          if (!chunk) break;
          doc.fillColor(color).font("Helvetica-Oblique").fontSize(size).text(chunk, startX, doc.y, {
            continued,
            width,
            lineGap: 2,
          });
          doc.font("Helvetica");
          break;
        }
        case "codespan":
          doc.fillColor(COLORS.codeText).font("Courier").fontSize(size - 0.5);
          doc.text(safeText(tok.text), startX, doc.y, { continued, width, lineGap: 2 });
          doc.font("Helvetica").fontSize(size);
          break;
        case "link": {
          const label = inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text));
          doc.fillColor(COLORS.accent).font("Helvetica").fontSize(size);
          doc.text(label, startX, doc.y, { continued, width, lineGap: 2, underline: true });
          break;
        }
        case "br":
          doc.text("\n", startX, doc.y, { width, lineGap: 2 });
          break;
        default: {
          const fallback = stripMarkdownSyntax(safeText(tok.text) || safeText(tok.raw));
          if (fallback) {
            doc.fillColor(color).font("Helvetica").fontSize(size).text(fallback, startX, doc.y, {
              continued,
              width,
              lineGap: 2,
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
      .fillColor(COLORS.subheading)
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text(text, { lineGap: 2 });
    doc.moveDown(0.25);
  };

  const renderParagraph = (tok: MarkdownToken) => {
    if (isLabelLine(tok)) {
      renderLabel(tok);
      return;
    }
    ensureSpace(28);
    if (tok.tokens?.length) {
      renderInline(tok.tokens);
    } else {
      const text = blockPlainText(tok);
      if (!text.trim()) return;
      doc.fillColor(COLORS.body).font("Helvetica").fontSize(10.5).text(text, { lineGap: 3 });
    }
    doc.moveDown(0.55);
  };

  const heading = (tok: MarkdownToken) => {
    const level = tok.depth ?? 2;
    const text = blockPlainText(tok);
    if (!text.trim()) return;

    ensureSpace(level <= 2 ? 48 : 32);
    const size = level === 1 ? 15 : level === 2 ? 12.5 : 11;
    const color = level >= 3 ? COLORS.subheading : COLORS.heading;

    doc.fillColor(color).font("Helvetica-Bold").fontSize(size).text(text.trim(), { lineGap: 2 });
    doc.moveDown(0.3);

    if (level <= 2) {
      doc
        .strokeColor(COLORS.rule)
        .lineWidth(0.75)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.55);
    } else {
      doc.moveDown(0.2);
    }
  };

  const renderListItem = (item: MarkdownToken, indent: number) => {
    ensureSpace(20);
    const bulletX = doc.page.margins.left + indent;
    const textX = bulletX + 12;
    const width = doc.page.width - doc.page.margins.right - textX;
    const startY = doc.y;

    doc
      .fillColor(COLORS.accent)
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text("•", bulletX, startY, { lineBreak: false });

    doc.x = textX;
    doc.y = startY;

    const nestedList = item.tokens?.find((t) => t.type === "list");
    const inlineSource = item.tokens?.filter((t) => t.type !== "list") ?? [];

    if (inlineSource.length) {
      renderInline(flattenInlineTokens(inlineSource), { width, x: textX });
    } else {
      const text = blockPlainText(item);
      if (text) {
        doc.fillColor(COLORS.body).font("Helvetica").fontSize(10.5).text(text, { width, lineGap: 3 });
      }
    }

    doc.moveDown(0.35);

    if (nestedList?.items?.length) {
      bullet(nestedList.items, indent + 16);
    }
  };

  const bullet = (items: MarkdownToken[], indent = 0) => {
    ensureSpace(18);
    for (const item of items) {
      renderListItem(item, indent);
    }
    doc.moveDown(0.25);
  };

  const codeBlock = (code: string) => {
    ensureSpace(50);
    const x = doc.page.margins.left;
    const width = contentWidth();
    const startY = doc.y;
    const cleanCode = code.replace(/\t/g, "  ");
    const padding = 10;

    doc.fillColor(COLORS.codeText).font("Courier").fontSize(9);
    const textHeight = doc.heightOfString(cleanCode, { width: width - padding * 2, lineGap: 2 });
    const boxHeight = textHeight + padding * 2;

    ensureSpace(boxHeight + 10);

    doc
      .save()
      .fillColor(COLORS.codeBg)
      .strokeColor(COLORS.codeBorder)
      .lineWidth(0.5)
      .roundedRect(x, startY, width, boxHeight, 4)
      .fillAndStroke()
      .restore();

    doc
      .fillColor(COLORS.codeText)
      .font("Courier")
      .fontSize(9)
      .text(cleanCode, x + padding, startY + padding, {
        width: width - padding * 2,
        lineGap: 2,
      });

    doc.y = startY + boxHeight + 8;
  };

  const quote = (tok: MarkdownToken) => {
    ensureSpace(36);
    const x = doc.page.margins.left;
    const width = contentWidth();
    const startY = doc.y;
    const text = blockPlainText(tok);
    const padding = 12;

    doc.fillColor(COLORS.body).font("Helvetica-Oblique").fontSize(10);
    const textHeight = doc.heightOfString(text.trim(), { width: width - padding * 2, lineGap: 3 });
    const boxHeight = textHeight + padding;

    doc.save().fillColor(COLORS.codeBg).rect(x, startY, width, boxHeight).fill().restore();
    doc
      .save()
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .moveTo(x, startY)
      .lineTo(x, startY + boxHeight)
      .stroke()
      .restore();

    doc
      .fillColor(COLORS.body)
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text(text.trim(), x + padding, startY + padding / 2, {
        width: width - padding * 2,
        lineGap: 3,
      });

    doc.y = startY + boxHeight + 8;
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
      bullet(tok.items ?? []);
      continue;
    }

    if (tok.type === "code") {
      codeBlock(safeText(tok.text) || safeText(tok.raw));
      continue;
    }

    if (tok.type === "hr") {
      ensureSpace(16);
      doc
        .strokeColor(COLORS.rule)
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.75);
      continue;
    }

    const text = blockPlainText(tok);
    if (text) {
      ensureSpace(28);
      doc.fillColor(COLORS.body).font("Helvetica").fontSize(10.5).text(text, { lineGap: 3 });
      doc.moveDown(0.55);
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
    margins: { top: 56, bottom: 72, left: 54, right: 54 },
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
