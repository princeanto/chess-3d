/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /*
   * Exported as static files, and that is a privacy decision rather than a
   * performance one.
   *
   * There is no server in this app because there is nowhere for one to put your
   * financial data. Everything — the Gmail request, the parsing, the ledger, the
   * cache — happens in your browser, and the only other machine involved is the
   * Apps Script running inside your own Google account.
   */
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
