import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sinag Ukit ERP",
    short_name: "Sinag Ukit",
    description: "Sinag Ukit ERP — POS, inventory, orders, and accounting.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6EFE4",
    theme_color: "#B68E44",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
