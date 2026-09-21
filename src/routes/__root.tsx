import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ClubQueryProvider } from "@/components/club/query-provider";
import { ClubShell } from "@/components/club/shell";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "KIY";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Bilyard klubi uchun kassa — stollar, seanslar, bar va kunlik hisobot.",
      },
      { name: "theme-color", content: "#0c100e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="uz" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <PreviewHostBridge />
        <AuthProvider>
          <ClubQueryProvider>
            <ClubShell />
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                classNames: {
                  toast: "bg-surface text-foreground border-border",
                },
              }}
            />
          </ClubQueryProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
