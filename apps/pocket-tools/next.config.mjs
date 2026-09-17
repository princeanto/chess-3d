/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * Static files and nothing else. There is no server for a file to be uploaded
   * to, which is the privacy promise made structural. Every tool gets its own
   * page (tools/<slug>/index.html) so a tool can be bookmarked, and the service
   * worker written after the build caches all of them.
   */
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
