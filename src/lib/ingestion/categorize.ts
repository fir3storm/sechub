import { prisma } from "@/lib/db";
import { stripHtmlTags } from "@/lib/ingestion/article-content";

/** Rule-based category inference from title, body, and CVE mentions. */
const CATEGORY_RULES: { slug: string; patterns: RegExp[] }[] = [
  {
    slug: "ransomware",
    patterns: [/ransomware/i, /lockbit/i, /blackcat/i, /conti/i, /encrypt(?:ed|ion)/i],
  },
  {
    slug: "phishing",
    patterns: [/phishing/i, /spear[\s-]?phish/i, /credential[\s-]?harvest/i, /business email compromise/i],
  },
  {
    slug: "zero-day",
    patterns: [/zero[\s-]?day/i, /0[\s-]?day/i, /actively exploited/i, /in-the-wild exploit/i],
  },
  {
    slug: "patch-tuesday",
    patterns: [/patch tuesday/i, /microsoft.*(?:update|patch|security)/i, /msrc/i, /windows update/i],
  },
  {
    slug: "vulnerability-disclosure",
    patterns: [/CVE-\d{4}-\d+/i, /vulnerabilit/i, /CVSS/i, /security flaw/i, /security bug/i],
  },
  {
    slug: "malware",
    patterns: [/malware/i, /trojan/i, /botnet/i, /backdoor/i, /rootkit/i, /spyware/i],
  },
  {
    slug: "data-breach",
    patterns: [/data breach/i, /leaked data/i, /exposed records/i, /stolen data/i, /database leak/i],
  },
  {
    slug: "supply-chain",
    patterns: [/supply chain/i, /third[\s-]?party/i, /dependency/i, /npm package/i],
  },
];

export function inferCategorySlugs(title: string, body: string, cveIds: string[]): string[] {
  const text = `${title} ${stripHtmlTags(body)} ${cveIds.join(" ")}`.toLowerCase();
  const matched: string[] = [];

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      matched.push(rule.slug);
    }
  }

  return matched;
}

export async function assignArticleCategories(
  articleId: string,
  title: string,
  body: string,
  cveIds: string[]
): Promise<string[]> {
  const slugs = inferCategorySlugs(title, body, cveIds);
  if (slugs.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { slug: { in: slugs } },
  });

  if (categories.length === 0) return [];

  await prisma.$transaction([
    prisma.newsArticleCategory.deleteMany({ where: { articleId } }),
    prisma.newsArticleCategory.createMany({
      data: categories.map((c) => ({ articleId, categoryId: c.id })),
      skipDuplicates: true,
    }),
  ]);

  return categories.map((c) => c.slug);
}
