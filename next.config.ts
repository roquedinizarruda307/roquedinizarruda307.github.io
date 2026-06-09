import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exportação estática para hospedar no GitHub Pages
  output: 'export',
  // GitHub Pages não otimiza imagens via servidor
  images: { unoptimized: true },
  // URLs com barra final funcionam melhor no Pages
  trailingSlash: true,
};

export default nextConfig;
