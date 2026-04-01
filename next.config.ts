import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'firebase-admin', 'drizzle-orm'],
};

export default nextConfig;
