import type { NextConfig } from "next";

// Em produção (GitHub Pages, subpasta /roquedinizarruda307) o workflow define
// NEXT_PUBLIC_BASE_PATH. No localhost fica vazio (site na raiz).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
