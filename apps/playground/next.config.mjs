/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * A static export with no server behind it, which is the product rather than
   * a deployment detail: there is nowhere for your work to be uploaded to. The
   * build step then writes a service worker listing every file in `out/`, so
   * tools you have never opened still work offline.
   */
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
