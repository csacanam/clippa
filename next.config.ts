import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Creator submit-clip flow includes a video file upload (~10–20MB MP4),
    // passed through a server action. Default is 1MB which would reject it.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
