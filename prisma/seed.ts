import { PrismaClient, Role, FeedType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ADVISORY_TEMPLATE, RANSOMWARE_TEMPLATE, VULNERABILITY_TEMPLATE, BREACH_TEMPLATE } from "../src/lib/advisory/template";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@sechub.local" },
    update: {},
    create: {
      email: "admin@sechub.local",
      name: "Super Admin",
      passwordHash,
      role: Role.SuperAdmin,
      mustChangePassword: true,
    },
  });

  const categories = [
    "Ransomware",
    "Phishing",
    "Zero-Day",
    "Patch Tuesday",
    "Vulnerability Disclosure",
    "Malware",
    "Data Breach",
    "Supply Chain",
  ];

  for (const name of categories) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }

  await prisma.advisoryTemplate.upsert({
    where: { id: "default-template" },
    update: { threatType: "general" },
    create: {
      id: "default-template",
      name: "Standard Security Advisory",
      description: "Default advisory template with executive summary, threat details, IOCs, and mitigation.",
      schema: JSON.parse(JSON.stringify(DEFAULT_ADVISORY_TEMPLATE)),
      threatType: "general",
      isDefault: true,
    },
  });

  const threatTemplates = [
    {
      id: "template-ransomware",
      name: "Ransomware Advisory",
      description: "Ransomware campaign bulletin with containment and recovery sections.",
      threatType: "ransomware",
      schema: RANSOMWARE_TEMPLATE,
    },
    {
      id: "template-vulnerability",
      name: "Vulnerability / CVE Advisory",
      description: "CVE-focused advisory with exploit status and remediation.",
      threatType: "vulnerability",
      schema: VULNERABILITY_TEMPLATE,
    },
    {
      id: "template-breach",
      name: "Data Breach Advisory",
      description: "Data breach incident bulletin with exposure and notification sections.",
      threatType: "breach",
      schema: BREACH_TEMPLATE,
    },
  ];

  for (const tmpl of threatTemplates) {
    await prisma.advisoryTemplate.upsert({
      where: { id: tmpl.id },
      update: {
        name: tmpl.name,
        description: tmpl.description,
        threatType: tmpl.threatType,
        schema: JSON.parse(JSON.stringify(tmpl.schema)),
      },
      create: {
        id: tmpl.id,
        name: tmpl.name,
        description: tmpl.description,
        threatType: tmpl.threatType,
        schema: JSON.parse(JSON.stringify(tmpl.schema)),
        isDefault: false,
      },
    });
  }

  const feeds = [
    { name: "NVD CVE Database", type: FeedType.NVD, url: null },
    { name: "CISA KEV Catalog", type: FeedType.CISA_KEV, url: null },
    { name: "CISA Advisories", type: FeedType.RSS, url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
    { name: "The Hacker News", type: FeedType.RSS, url: "https://feeds.feedburner.com/TheHackersNews" },
    { name: "BleepingComputer", type: FeedType.RSS, url: "https://www.bleepingcomputer.com/feed/" },
    { name: "Krebs on Security", type: FeedType.RSS, url: "https://krebsonsecurity.com/feed/" },
    { name: "Google Security Blog", type: FeedType.RSS, url: "https://security.googleblog.com/feeds/posts/default" },
    { name: "Microsoft MSRC", type: FeedType.RSS, url: "https://api.msrc.microsoft.com/update-guide/rss" },
    { name: "Cisco Talos Intelligence", type: FeedType.RSS, url: "https://blog.talosintelligence.com/rss/" },
    { name: "SANS ISC Diary", type: FeedType.RSS, url: "https://isc.sans.edu/rssfeed.xml" },
  ];

  for (const feed of feeds) {
    const existing = await prisma.feedSource.findFirst({
      where: { name: feed.name },
    });
    if (!existing) {
      await prisma.feedSource.create({ data: feed });
    }
  }

  const demoArticles = [
    {
      title: "Critical RCE in Example VPN Appliance",
      summary: "A critical remote code execution vulnerability affects Example VPN appliances.",
      body: "Security researchers disclosed CVE-2024-12345 affecting Example VPN appliances running firmware < 9.1.2. Exploitation requires authenticated access.",
      sourceName: "manual",
      publishedAt: new Date(),
      severity: "critical" as const,
      cveIds: ["CVE-2024-12345"],
      cvssScore: 9.8,
      affectedDevices: ["example:vpn_appliance"],
      affectedOs: ["linux:kernel"],
      status: "curated" as const,
      createdById: admin.id,
    },
  ];

  for (const article of demoArticles) {
    const exists = await prisma.newsArticle.findFirst({
      where: { title: article.title },
    });
    if (!exists) {
      await prisma.newsArticle.create({ data: article });
    }
  }

  console.log("Seed complete:");
  console.log("  Email: admin@sechub.local");
  console.log("  Password: admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
