/** @type {import('next').NextConfig} */
const nextConfig = {
  // NO standalone output — SuperHosting gets full project with node_modules
  env: {
    APP_URL: process.env.APP_URL || 'https://afterme.life',
  },
  trailingSlash: false,
};

module.exports = nextConfig;
