/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/analyze/:path*",
          destination: "http://localhost:5328/api/analyze/:path*",
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
