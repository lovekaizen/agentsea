/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      enabled: true,
    },
  },
  webpack: (config) => {
    // Fix for better-sqlite3
    config.externals = [...(config.externals || []), 'better-sqlite3'];
    return config;
  },
};

module.exports = nextConfig;
