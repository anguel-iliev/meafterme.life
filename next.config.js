/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',          // Static HTML export — works on Apache
  trailingSlash: true,       // /demo/ instead of /demo — needed for Apache
  images: {
    unoptimized: true,       // Required for static export
  },
  env: {
    APP_URL: process.env.APP_URL || 'https://afterme.life',
    NEXT_PUBLIC_APP_URL: process.env.APP_URL || 'https://afterme.life',
    NEXT_PUBLIC_FIREBASE_API_KEY:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    NEXT_PUBLIC_FIREBASE_APP_ID:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  },
};

module.exports = nextConfig;
