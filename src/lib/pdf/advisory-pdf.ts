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

function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.save();
  doc
    .roundedRect(x, y, 28, 28, 4)
    .fillColor("#0e7490")
    .fill();
  doc
    .moveTo(x + 8, y + 20)
    .lineTo(x + 14, y + 8)
    .lineTo(x + 20, y + 20)
    .closePath()
    .fillColor("#22d3ee")
    .fill();
  doc.restore();

  doc
    .fillColor("#22d3ee")
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("SecHub", x + 36, y + 2);

  doc
    .fillColor("#64748b")
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
    .fillColor("#451a03")
    .rect(x, y, width, 22)
    .fill()
    .restore();

  doc
    .fillColor("#fbbf24")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(classification.toUpperCase(), x, y + 6, { width, align: "center" });

  doc.y = y + 28;
}

function drawBrandedHeader(doc: PDFKit.PDFDocument, meta: Meta) {
  const x = doc.page.margins.left;
  drawLogo(doc, x, doc.y);
  doc.y += 36;

  drawClassificationBanner(doc, meta.classification || "TLP:AMBER — INTERNAL USE ONLY");

  const title = meta.title || "Security Advisory";
  doc
    .fillColor("#06b6d4")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(title, { align: "left" });

  doc.moveDown(0.35);

  const line: string[] = [];
  if (meta.status) line.push(String(meta.status).toUpperCase());
  if (meta.author) line.push(meta.author);
  if (meta.updatedAt) line.push(meta.updatedAt.toISOString().slice(0, 10));

  if (line.length) {
    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(10)
      .text(line.join(" · "), { align: "left" });
  }

  doc.moveDown(0.8);
  doc
    .strokeColor("#155e75")
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.8);
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
      .strokeColor("#155e75")
      .lineWidth(0.5)
      .moveTo(left, bottom - 4)
      .lineTo(right, bottom - 4)
      .stroke();

    doc
      .fillColor("#64748b")
      .font("Helvetica")
      .fontSize(8);

    doc.text(`Generated on ${generatedAt} UTC · SecHub / Bramhashiv AI`, left, bottom, {
      width: width * 0.7,
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
  const tokens = marked.lexer(markdown ?? "");

  const bodyColor = "#cbd5e1";
  const headingColor = "#e2e8f0";
  const accentColor = "#22d3ee";

  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 40;

  const ensureSpace = (needed = 40) => {
    if (doc.y + needed > bottomLimit()) doc.addPage();
  };

  const para = (t: string) => {
    const text = t.trim();
    if (!text) return;
    ensureSpace(30);
    doc
      .fillColor(bodyColor)
      .font("Helvetica")
      .fontSize(11)
      .text(text, { lineGap: 3 });
    doc.moveDown(0.6);
  };

  const heading = (t: string, level: number) => {
    ensureSpace(50);
    const size = level === 1 ? 18 : level === 2 ? 14 : 12;
    doc
      .fillColor(headingColor)
      .font("Helvetica-Bold")
      .fontSize(size)
      .text(t.trim(), { lineGap: 2 });
    doc.moveDown(0.4);
    if (level <= 2) {
      doc
        .strokeColor("#155e75")
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.8);
    }
  };

  const bullet = (items: string[]) => {
    ensureSpace(20);
    doc.fillColor(bodyColor).font("Helvetica").fontSize(11);
    for (const it of items) {
      const text = it.trim();
      if (!text) continue;
      ensureSpace(20);
      doc.fillColor(accentColor).text("•", { continued: true });
      doc.fillColor(bodyColor).text(` ${text}`, { lineGap: 3 });
    }
    doc.moveDown(0.6);
  };

  const codeBlock = (code: string) => {
    ensureSpace(60);
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;

    doc
      .save()
      .fillColor("#071018")
      .roundedRect(x, startY, width, 10, 6)
      .fill()
      .restore();

    doc
      .fillColor("#a5f3fc")
      .font("Courier")
      .fontSize(9.5)
      .text(code.replace(/\t/g, "  "), x + 10, startY + 8, {
        width: width - 20,
        lineGap: 2,
      });

    doc.moveDown(0.8);
  };

  const quote = (t: string) => {
    ensureSpace(40);
    const x = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startY = doc.y;

    doc
      .save()
      .fillColor("#06161f")
      .roundedRect(x, startY, width, 10, 6)
      .fill()
      .restore();

    doc
      .fillColor("#bae6fd")
      .font("Helvetica-Oblique")
      .fontSize(10.5)
      .text(t.trim(), x + 12, startY + 8, { width: width - 24, lineGap: 3 });

    doc.moveDown(0.8);
  };

  for (const tok of tokens) {
    if (tok.type === "space") continue;

    if (tok.type === "heading") {
      heading(safeText((tok as { text?: string }).text), (tok as { depth?: number }).depth ?? 2);
      continue;
    }

    if (tok.type === "paragraph") {
      para(safeText((tok as { text?: string }).text));
      continue;
    }

    if (tok.type === "blockquote") {
      const inner = (tok as { tokens?: { text?: string }[] }).tokens ?? [];
      const text = inner
        .map((t) => safeText(t.text))
        .filter(Boolean)
        .join("\n");
      quote(text || safeText((tok as { text?: string }).text));
      continue;
    }

    if (tok.type === "list") {
      const items = ((tok as { items?: { text?: string }[] }).items ?? [])
        .map((it) => safeText(it.text))
        .filter(Boolean);
      bullet(items);
      continue;
    }

    if (tok.type === "code") {
      codeBlock(safeText((tok as { text?: string }).text));
      continue;
    }

    if (tok.type === "hr") {
      ensureSpace(20);
      doc
        .strokeColor("#155e75")
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(1);
      continue;
    }

    const text =
      safeText((tok as { text?: string }).text) || safeText((tok as { raw?: string }).raw);
    if (text) para(text);
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
