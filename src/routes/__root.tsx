import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { lazy, Suspense, type ReactNode } from "react";

import appCss from "../styles.css?url";

const Toaster = lazy(() => import("sonner").then((m) => ({ default: m.Toaster })));

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0D1B2A" },
      { title: "Pocket AI — Multilingual Assistant" },
      { name: "description", content: "A private, stateless AI chat. Nothing stored, replies in your language." },
      { property: "og:title", content: "Pocket AI — Multilingual Assistant" },
      { property: "og:description", content: "A private, stateless AI chat. Nothing stored, replies in your language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preload", as: "style", href: appCss },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://ai.gateway.lovable.dev", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://ai.gateway.lovable.dev" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground">
        Back to chat
      </Link>
    </div>
  ),
});

const queryClient = new QueryClient();

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootShell>
        <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col">
          <Outlet />
        </div>
      </RootShell>
      <Suspense fallback={null}>
        <Toaster theme="dark" position="top-center" />
      </Suspense>
    </QueryClientProvider>
  );
}
