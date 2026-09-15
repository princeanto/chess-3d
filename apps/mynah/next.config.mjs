/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * A static export. The course, your progress and the review schedule all live
   * in the browser: there is no account to make, nothing to pay for, and the app
   * keeps working on a train with no signal.
   */
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
