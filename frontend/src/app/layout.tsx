import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientShell from "./client-shell";

export const metadata: Metadata = {
  title: "CampusConnect — NIT Goa Food Delivery",
  description: "P2P food delivery by students, for students at NIT Goa",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
