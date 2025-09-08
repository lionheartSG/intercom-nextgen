import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Cache audio files (like ringtone) for 1 year
      {
        source: "/ringtone.mp3",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache other audio files
      {
        source: "/:path*.(mp3|wav|ogg|m4a)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache images for 1 year
      {
        source: "/:path*.(jpg|jpeg|png|gif|webp|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache fonts for 1 year
      {
        source: "/:path*.(woff|woff2|eot|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache CSS and JS files for 1 year (these are usually hashed by Next.js)
      {
        source: "/:path*.(css|js)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache other static assets for 30 days
      {
        source: "/:path*.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
