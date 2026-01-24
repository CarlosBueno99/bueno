import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone',
  // No env section needed.
  // pageExtensions: ['page.tsx', 'page.ts'],  <-- REMOVE THIS LINE
  
  // Mark Node.js-specific packages as external so they're loaded from
  // node_modules at runtime instead of being bundled. This is required
  // for packages like steam-user that use native Node.js modules.
  serverExternalPackages: [
    'steam-user',
    'globaloffensive',
  ],
};

export default nextConfig;
