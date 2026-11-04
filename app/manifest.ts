import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Afterhours",
    short_name: "Afterhours",
    description: "A shared camera roll for nights out.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#141311",
    theme_color: "#141311",
    icons: [
      { src: "/icons/afterhours-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/afterhours-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/afterhours-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
