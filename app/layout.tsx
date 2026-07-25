import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: "Hawker Balance — Run the centre. Read the plate.",
    description:
      "A local-first Singapore hawker-centre management game about service, menu trade-offs, and nutrition education.",
    applicationName: "Hawker Balance",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Hawker Balance",
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: "Hawker Balance",
      description: "Run the centre. Read the plate.",
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1730,
          height: 909,
          alt: "An illustrated Hawker Balance centre with three stalls, communal tables, diners, and menu trade-off cards.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hawker Balance",
      description: "Run the centre. Read the plate.",
      images: [socialImage],
    },
    icons: {
      icon: "/icons/icon.svg",
      shortcut: "/icons/icon.svg",
      apple: "/icons/icon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
