/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => [
    {
      source: "/api/analyze",
      destination: "http://localhost:5328/api/analyze",
    },
  ],
};

module.exports = nextConfig;
