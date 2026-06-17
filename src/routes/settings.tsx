import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Moon, Sun, Trash2, MessageCircle } from "lucide-react";
import { clearAll } from "@/lib/chat-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Pocket Chat Bro" },
      { name: "description", content: "Customize your Pocket Chat Bro experience." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggleTheme() {
    const next = !isLight;
    setIsLight(next);
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("pcb:theme", next ? "light" : "dark");
  }

  function onClear() {
    if (confirm("Clear all chats? This cannot be undone.")) {
      clearAll();
      navigate({ to: "/" });
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-3 pt-5 pb-3">
        <Link
          to="/"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg font-bold">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/30">
            <MessageCircle className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h2 className="font-display text-xl font-bold">Pocket Chat Bro</h2>
            <p className="text-xs text-muted-foreground">v1.0.0</p>
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl bg-card">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-background/40"
          >
            <div className="flex items-center gap-3">
              {isLight ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
              <div>
                <p className="text-sm font-medium">Appearance</p>
                <p className="text-xs text-muted-foreground">{isLight ? "Light mode" : "Dark mode"}</p>
              </div>
            </div>
            <div className={`relative h-6 w-11 rounded-full transition ${isLight ? "bg-primary" : "bg-muted"}`}>
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  isLight ? "left-[22px]" : "left-0.5"
                }`}
              />
            </div>
          </button>

          <div className="h-px bg-border" />

          <button
            onClick={onClear}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-destructive transition hover:bg-background/40"
          >
            <Trash2 className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Clear all chats</p>
              <p className="text-xs text-muted-foreground">Reset all conversations to defaults</p>
            </div>
          </button>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Made with <span className="text-primary">♥</span> for your pocket
        </p>
      </div>
    </div>
  );
}
