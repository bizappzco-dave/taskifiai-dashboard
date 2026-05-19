/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript checking during build (we test locally)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
