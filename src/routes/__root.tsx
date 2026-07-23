import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

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
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
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
      <Toaster theme="dark" position="top-center" />
    </QueryClientProvider>
  );
}
