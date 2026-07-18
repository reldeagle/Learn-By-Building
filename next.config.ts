import type { NextConfig } from "next";

import { validateProductionConfig } from "./src/lib/config";

if (process.env.VERCEL_ENV === "production") {
  validateProductionConfig();
}

const nextConfig: NextConfig = {};

export default nextConfig;
