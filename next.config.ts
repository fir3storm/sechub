import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit loads Helvetica.afm from disk at runtime; bundling breaks that path in production.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
