import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Emit a minimal, traced runtime for the production container. The workspace
  // is built from apps/web, so tracing must include the monorepo root.
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  deploymentId: process.env.DEPLOYMENT_VERSION,
};

export default nextConfig;
