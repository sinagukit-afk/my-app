import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows dev-server assets (CSS/JS chunks, HMR) to load when testing over the LAN,
  // e.g. from an iPad at http://<this-machine's-LAN-IP>:3000 — Next.js blocks these
  // cross-origin by default even though the page HTML itself still loads.
  allowedDevOrigins: ["192.168.68.109"],
};

export default nextConfig;
