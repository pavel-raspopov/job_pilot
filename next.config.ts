import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  // The resume PDF reads its Inter TTFs from disk at render time. Nothing
  // imports them, so file tracing cannot infer them and the serverless bundle
  // ships without them — working in dev and failing only in production, the
  // same trap `maxDuration` set in Feature 07.
  //
  // Note: @react-pdf/renderer needs no `serverExternalPackages` entry — it is
  // already in Next.js's default externals list.
  outputFileTracingIncludes: {
    "/api/resume/generate": ["./app/api/resume/generate/fonts/**"],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
