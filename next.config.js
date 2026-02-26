/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Use APP_URL env for canonical
  env: {
    APP_URL: process.env.APP_URL || 'https://afterme.life',
  },
  // Trailing slash canonical preference
  trailingSlash: false,
};

module.exports = nextConfig;
