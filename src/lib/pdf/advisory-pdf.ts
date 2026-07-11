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
};

/** Print-oriented palette — dark text on white paper, muted corporate accents. */
const COLORS = {
  title: "#1a365d",
  heading: "#2c5282",
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
  quoteBg: "#f8fafc",
  quoteBorder: "#4299e1",
  quoteText: "#4a5568",
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

/** Fallback: strip leftover markdown syntax when inline tokens are missing. */
function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function inlinePlainText(tokens: MarkdownToken[] | undefined): string {
  if (!tokens?.length) return "";
  return tokens
    .map((tok) => {
      if (tok.type === "text") return safeText(tok.text);
      if (tok.type === "codespan") return safeText(tok.text);
      if (tok.type === "escape") return safeText(tok.text);
      if (tok.type === "br") return "\n";
      if (tok.type === "link") return inlinePlainText(tok.tokens) || safeText(tok.text);
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
  if (typeof tok.text === "string" && tok.text.trim()) {
    return stripMarkdownSyntax(tok.text);
  }
  return stripMarkdownSyntax(safeText(tok.raw));
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

  doc
    .fillColor(COLORS.brand)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("SecHub", x + 36, y + 2);

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
    .text(classification.toUpperCase(), x, y + 7, { width, align: "center" });

  doc.y = y + 32;
}

function drawBrandedHeader(doc: PDFKit.PDFDocument, meta: Meta) {
  const x = doc.page.margins.left;
  drawLogo(doc, x, doc.y);
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

function addPageFooters(doc: PDFKit.PDFDocument, meta: Meta) {
  const generatedAt = (meta.generatedAt ?? new Date()).toISOString().replace("T", " ").slice(0, 19);
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageNum = i - range.start + 1;
    const totalPages = range.count;
    const bottom = doc.page.height - doc.page.margins.bottom + 8;
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    doc
      .strokeColor(COLORS.rule)
      .lineWidth(0.5)
      .moveTo(left, bottom - 4)
      .lineTo(right, bottom - 4)
      .stroke();

    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8);

    doc.text(`SecHub Security Advisory · Generated ${generatedAt} UTC`, left, bottom, {
      width: width * 0.72,
      align: "left",
      lineBreak: false,
    });

    doc.text(`Page ${pageNum} of ${totalPages}`, left, bottom, {
      width,
      align: "right",
      lineBreak: false,
    });
  }
}

function renderMarkdownTokens(doc: PDFKit.PDFDocument, markdown: string) {
  const tokens = marked.lexer(markdown ?? "") as MarkdownToken[];

  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 40;

  const ensureSpace = (needed = 40) => {
    if (doc.y + needed > bottomLimit()) doc.addPage();
  };

  const renderInline = (
    inlineTokens: MarkdownToken[] | undefined,
    opts: { color?: string; size?: number; width?: number; indent?: number } = {}
  ) => {
    const color = opts.color ?? COLORS.body;
    const size = opts.size ?? 11;
    const width = opts.width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const x = doc.page.margins.left + (opts.indent ?? 0);

    if (!inlineTokens?.length) return;

    for (let i = 0; i < inlineTokens.length; i++) {
      const tok = inlineTokens[i];
      const continued = i < inlineTokens.length - 1;

      switch (tok.type) {
        case "text":
          doc.fillColor(color).font("Helvetica").fontSize(size).text(safeText(tok.text), {
            continued,
            width,
            lineGap: 3,
          });
          break;
        case "strong":
          doc.fillColor(color).font("Helvetica-Bold").fontSize(size);
          if (tok.tokens?.length) {
            renderInline(tok.tokens, { color, size, width, indent: opts.indent });
          } else {
            doc.text(stripMarkdownSyntax(safeText(tok.text)), { continued, width, lineGap: 3 });
          }
          doc.font("Helvetica");
          break;
        case "em":
          doc.fillColor(color).font("Helvetica-Oblique").fontSize(size);
          if (tok.tokens?.length) {
            renderInline(tok.tokens, { color, size, width, indent: opts.indent });
          } else {
            doc.text(stripMarkdownSyntax(safeText(tok.text)), { continued, width, lineGap: 3 });
          }
          doc.font("Helvetica");
          break;
        case "codespan":
          doc.fillColor(COLORS.codeText).font("Courier").fontSize(size - 0.5);
          doc.text(safeText(tok.text), { continued, width, lineGap: 3 });
          doc.font("Helvetica").fontSize(size);
          break;
        case "link":
          doc.fillColor(COLORS.accent).font("Helvetica").fontSize(size);
          doc.text(inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text)), {
            continued,
            width,
            lineGap: 3,
            underline: true,
          });
          break;
        case "del":
          doc.fillColor(COLORS.muted).font("Helvetica").fontSize(size);
          doc.text(inlinePlainText(tok.tokens) || stripMarkdownSyntax(safeText(tok.text)), {
            continued,
            width,
            lineGap: 3,
            strike: true,
          });
          break;
        case "br":
          doc.text("\n", x, doc.y, { width, lineGap: 3 });
          break;
        default:
          if (tok.tokens?.length) {
            renderInline(tok.tokens, { color, size, width, indent: opts.indent });
          } else {
            const fallback = stripMarkdownSyntax(safeText(tok.text) || safeText(tok.raw));
            if (fallback) {
              doc.fillColor(color).font("Helvetica").fontSize(size).text(fallback, {
                continued,
                width,
                lineGap: 3,
              });
            }
          }
      }
    }
  };

  const renderParagraph = (tok: MarkdownToken) => {
    ensureSpace(30);
    if (tok.tokens?.length) {
      renderInline(tok.tokens);
    } else {
      const text = blockPlainText(tok);
      if (!text.trim()) return;
      doc.fillColor(COLORS.body).font("Helvetica").fontSize(11).text(text, { lineGap: 4 });
    }
    doc.moveDown(0.65);
  };

  const heading = (tok: MarkdownToken) => {
    const level = tok.depth ?? 2;
    const text = blockPlainText(tok);
    if (!text.trim()) return;

    ensureSpace(50);
    const size = level === 1 ? 16 : level === 2 ? 13 : 11.5;
    doc
      .fillColor(COLORS.heading)
      .font("Helvetica-Bold")
      .fontSize(size)
      .text(text.trim(), { lineGap: 2 });
    doc.moveDown(0.35);

    if (level <= 2) {
      doc
        .strokeColor(COLORS.rule)
        .lineWidth(0.75)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.65);
    } else {
      doc.moveDown(0.25);
    }
  };

  const bullet = (items: MarkdownToken[]) => {
    ensureSpace(20);
    const bulletX = doc.page.margins.left;
    const textX = bulletX + 14;
    const width = doc.page.width - doc.page.margins.right - textX;

    for (const item of items) {
      ensureSpace(22);
      const startY = doc.y;

      doc
        .fillColor(COLORS.accent)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("•", bulletX, startY, { lineBreak: false });

      doc.x = textX;
      doc.y = startY;

      const paragraph = item.tokens?.find((t) => t.type === "paragraph");
      if (paragraph?.tokens?.length) {
        renderInline(paragraph.tokens, { width });
      } else if (item.tokens?.length) {
        renderInline(item.tokens, { width });
      } else {
        const text = blockPlainText(item);
        if (text) {
          doc.fillColor(COLORS.body).font("Helvetica").fontSize(11).text(text, { width, lineGap: 4 });
        }
      }

      doc.moveDown(0.45);
    }
    doc.moveDown(0.35);
  };

  const codeBlock = (code: string) => {
    ensureSpace(60);
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;
    const cleanCode = code.replace(/\t/g, "  ");

    doc
      .save()
      .fillColor(COLORS.codeBg)
      .strokeColor(COLORS.codeBorder)
      .lineWidth(0.5)
      .roundedRect(x, startY, width, 10, 4)
      .fillAndStroke()
      .restore();

    doc
      .fillColor(COLORS.codeText)
      .font("Courier")
      .fontSize(9)
      .text(cleanCode, x + 12, startY + 10, {
        width: width - 24,
        lineGap: 2,
      });

    doc.moveDown(0.9);
  };

  const quote = (tok: MarkdownToken) => {
    ensureSpace(40);
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;
    const text = blockPlainText(tok);

    doc.save().fillColor(COLORS.quoteBg).rect(x, startY, width, 10).fill().restore();
    doc
      .save()
      .strokeColor(COLORS.quoteBorder)
      .lineWidth(2)
      .moveTo(x, startY)
      .lineTo(x, startY + 10)
      .stroke()
      .restore();

    doc
      .fillColor(COLORS.quoteText)
      .font("Helvetica-Oblique")
      .fontSize(10.5)
      .text(text.trim(), x + 14, startY + 8, { width: width - 24, lineGap: 3 });

    doc.moveDown(0.85);
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
      ensureSpace(20);
      doc
        .strokeColor(COLORS.rule)
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.9);
      continue;
    }

    const text = blockPlainText(tok);
    if (text) {
      ensureSpace(30);
      doc.fillColor(COLORS.body).font("Helvetica").fontSize(11).text(text, { lineGap: 4 });
      doc.moveDown(0.65);
    }
  }
}

export async function renderAdvisoryPdf(args: {
  meta: Meta;
  markdown: string;
}): Promise<Buffer> {
  const generatedAt = args.meta.generatedAt ?? new Date();

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 64, left: 54, right: 54 },
    bufferPages: true,
    info: {
      Title: args.meta.title,
      Producer: "SecHub",
      Creator: "SecHub / Bramhashiv AI",
    },
  });

  const bufPromise = collectBuffer(doc);

  drawBrandedHeader(doc, { ...args.meta, generatedAt });
  renderMarkdownTokens(doc, args.markdown);
  addPageFooters(doc, { ...args.meta, generatedAt });

  doc.end();
  return bufPromise;
}
