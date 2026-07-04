/** Recommended RSS feeds — add via Settings → Intel Feeds */
export const RECOMMENDED_RSS_FEEDS = [
  {
    name: "CISA Advisories",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    description: "US government cybersecurity advisories (AA, alerts)",
  },
  {
    name: "CISA News",
    url: "https://www.cisa.gov/news.xml",
    description: "CISA press releases and news",
  },
  {
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    description: "Breaking cyber security news, threats, vulnerabilities",
  },
  {
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    description: "Malware, ransomware, breaches, patches",
  },
  {
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    description: "In-depth investigative security journalism",
  },
  {
    name: "Google Security Blog",
    url: "https://security.googleblog.com/feeds/posts/default",
    description: "Google threat research and security updates",
  },
  {
    name: "Microsoft MSRC",
    url: "https://api.msrc.microsoft.com/update-guide/rss",
    description: "Microsoft security updates and patch Tuesday",
  },
  {
    name: "Cisco Talos Intelligence",
    url: "https://blog.talosintelligence.com/rss/",
    description: "Threat research from Cisco Talos",
  },
  {
    name: "SANS ISC Diary",
    url: "https://isc.sans.edu/rssfeed.xml",
    description: "Internet Storm Center — daily threat diary",
  },
  {
    name: "US-CERT Alerts",
    url: "https://www.cisa.gov/uscert/ncas/alerts.xml",
    description: "National Cyber Awareness System alerts",
  },
  {
    name: "CERT-EU",
    url: "https://cert.europa.eu/publications/security-advisories-rss.rss",
    description: "EU agency cybersecurity advisories",
  },
  {
    name: "Ars Technica Security",
    url: "https://feeds.arstechnica.com/arstechnica/security",
    description: "Security section of Ars Technica",
  },
] as const;

/** Built-in non-RSS feeds (configured automatically) */
export const BUILTIN_FEEDS = [
  {
    name: "NVD CVE Database",
    type: "NVD",
    description: "NIST National Vulnerability Database — all published CVEs",
  },
  {
    name: "CISA KEV Catalog",
    type: "CISA_KEV",
    description: "Known Exploited Vulnerabilities — actively exploited in the wild",
  },
] as const;
