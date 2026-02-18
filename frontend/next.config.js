/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Production Docker için standalone çıktı (daha küçük image)
  output: 'standalone',
}

module.exports = nextConfig
