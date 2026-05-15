import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

/** Pin tracing to this app so Next does not pick a parent-folder lockfile as workspace root. */
const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
};

export default nextConfig;
