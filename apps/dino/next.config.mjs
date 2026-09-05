/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exported as static files: the game is entirely client-side, and a static
  // bundle is what lets the service worker cache the whole app for offline use.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
