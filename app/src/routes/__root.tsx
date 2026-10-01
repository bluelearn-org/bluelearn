import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";
import { SuspendedBanner } from "@/components/SuspendedBanner";
import { Footer } from "@/components/Footer";
import { NotFound } from "@/components/NotFound";
import { ErrorFallback } from "@/components/ErrorFallback";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/authContext";
import { ThemeProvider } from "@/lib/themeProvider";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Bluelearn | Free Structured Knowledge.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => <NotFound />,
  errorComponent: ErrorFallback,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <ScriptOnce>
          {`(function(){try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()`}
        </ScriptOnce>
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <SuspendedBanner />
              <TooltipProvider>
                <main className="flex-1">{children}</main>
              </TooltipProvider>
              <Footer />
            </div>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
