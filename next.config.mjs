/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_WORKER_URL: process.env.WORKER_PUBLIC_URL || "http://localhost:4000",
  },
};

export default nextConfig;
