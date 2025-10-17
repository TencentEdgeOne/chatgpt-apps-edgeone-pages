/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://chatgpt-apps-edgeone-pages.edgeone.run',
  outputFileTracingRoot: __dirname,
}

module.exports = nextConfig
