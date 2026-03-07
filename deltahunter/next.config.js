/** @type {import('next').NextConfig} */
const nextConfig = {
  rewrites: async () => {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/analyze",
          destination: "http://localhost:5328/api/analyze",
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
