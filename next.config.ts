import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // geoip-country reads its offline IP→country database from disk at runtime
  serverExternalPackages: ["geoip-country"],
};

export default nextConfig;
