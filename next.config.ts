import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["3000-812cba25-90e2-4ce1-ac64-8ba89d62260e.daytonaproxy01.net"],
  // pdf.js loads its parsing worker by resolving a path relative to its own
  // module. Bundling it moves it into .next/**/chunks/ where that path no
  // longer exists, and every parse dies with "Setting up fake worker failed".
  // Keeping both packages external preserves their on-disk layout.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
