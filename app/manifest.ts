import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GUITAR TOGETHER",
    short_name: "GUITAR",
    description: "기타 밴드 동호회 전용 PWA",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#181311",
    theme_color: "#181311",
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
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
