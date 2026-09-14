/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * A static export, like the other apps here. The whole game runs in the
   * browser — there is nothing for a server to do, and nothing it could hold.
   */
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
