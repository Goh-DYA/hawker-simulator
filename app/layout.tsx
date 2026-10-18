/**
 * The root layout of the app: the document shell, global styles and page metadata.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

/**
 * Builds the page metadata for the request.
 *
 * The social image needs an absolute URL, so the metadata base is derived from the
 * request's forwarded or direct host (default `localhost:3000`) and its forwarded
 * protocol, falling back to http for localhost or 127.0.0.1 and https otherwise.
 *
 * @returns The page title, description, manifest, icons and social-card metadata.
 */
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
          width: 1731,
          height: 908,
          alt: "An illustrated top-down Hawker Balance centre filled with stalls, tables, diners, and nutrition cues.",
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

/**
 * Renders the root HTML document around the page.
 *
 * @param props - The layout props.
 * @param props.children - The page content.
 * @returns The `<html>` and `<body>` shell.
 */
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
