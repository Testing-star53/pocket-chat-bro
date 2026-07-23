import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { chatWithAI } from "@/lib/ai.functions";
import { BotIcon, SendIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pocket AI — Private Multilingual Chat" },
      { name: "description", content: "Chat with Pocket AI in any language. No accounts, no history, nothing stored." },
      { property: "og:title", content: "Pocket AI — Private Multilingual Chat" },
      { property: "og:description", content: "Chat with Pocket AI in any language. No accounts, no history, nothing stored." },
      { property: "og:url", content: "https://pocket-chat-bro.lovable.app/" },
      { name: "twitter:title", content: "Pocket AI — Private Multilingual Chat" },
      { name: "twitter:description", content: "Chat with Pocket AI in any language. No accounts, no history, nothing stored." },
    ],
    links: [{ rel: "canonical", href: "https://pocket-chat-bro.lovable.app/" }],
  }),
  component: ChatPage,
});

type Message = { id: string; role: "user" | "assistant"; content: string };

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasScrolledOnce = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: hasScrolledOnce.current ? "smooth" : "auto" });
    hasScrolledOnce.current = true;
  }, [messages, sending]);


  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const { reply } = await chatWithAI({
        data: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function clearAll() {
    if (messages.length === 0) return;
    setMessages([]);
    toast.success("Conversation cleared");
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 bg-card/40 px-4 py-3 backdrop-blur">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <BotIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold leading-tight">Pocket AI</h1>
          <p className="text-xs text-muted-foreground">Multilingual · Private · Stateless</p>
        </div>
        <button
          onClick={clearAll}
          disabled={messages.length === 0}
          aria-label="Clear conversation"
          className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !sending ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary">
              <BotIcon className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Say hello in any language</h2>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Pocket AI replies in your language. Nothing is stored — refresh to start over.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-card text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-card px-4 py-3 text-muted-foreground">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Message Pocket AI…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl bg-card px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95 disabled:opacity-40"
          >
            {sending ? <SpinnerIcon className="h-5 w-5" /> : <SendIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
