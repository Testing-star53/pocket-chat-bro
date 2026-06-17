import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings, MessageCircle } from "lucide-react";
import { CONTACTS } from "@/lib/contacts";
import { loadAll, loadUnread } from "@/lib/chat-store";
import { formatRelative } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pocket Chat Bro — Your pocket chats" },
      { name: "description", content: "A cozy, Telegram-style chat app just for you." },
    ],
  }),
  component: ChatListPage,
});

function ChatListPage() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, []);

  const all = loadAll();
  const unread = loadUnread();

  const items = CONTACTS.map((c) => {
    const msgs = all[c.id] ?? [];
    const last = msgs[msgs.length - 1];
    return { c, last, unread: unread[c.id] ?? 0 };
  }).sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0));

  // tick is read only to keep React happy
  void tick;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight">
              Pocket <span className="text-primary">Chat Bro</span>
            </h1>
            <p className="text-xs text-muted-foreground">Your pocket companion</p>
          </div>
        </div>
        <Link
          to="/settings"
          className="grid h-10 w-10 place-items-center rounded-xl bg-card text-muted-foreground transition hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </header>

      <ul className="no-scrollbar flex-1 overflow-y-auto px-2 py-2">
        {items.map(({ c, last, unread }) => (
          <li key={c.id}>
            <Link
              to="/chat/$contactId"
              params={{ contactId: c.id }}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 transition active:scale-[0.98] active:bg-card"
            >
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${c.color} text-sm font-semibold text-white shadow-md`}>
                {c.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-semibold">{c.name}</h2>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {last ? formatRelative(last.ts) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-muted-foreground">
                    {last ? (last.from === "out" ? "You: " : "") + last.text : "Say hi 👋"}
                  </p>
                  {unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
