import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Smile, CheckCheck, Copy, Trash2 } from "lucide-react";
import { CONTACTS, AUTO_REPLIES } from "@/lib/contacts";
import {
  appendMessage,
  bumpUnread,
  deleteMessage,
  loadFor,
  setUnread,
  type Message,
} from "@/lib/chat-store";
import { formatTime } from "@/lib/format";

export const Route = createFileRoute("/chat/$contactId")({
  head: ({ params }) => {
    const c = CONTACTS.find((x) => x.id === params.contactId);
    return {
      meta: [
        { title: c ? `${c.name} — Pocket Chat Bro` : "Chat" },
        { name: "description", content: `Chat with ${c?.name ?? "your contact"}` },
      ],
    };
  },
  component: ChatPage,
});

const EMOJIS = ["😀","😂","🥲","😍","😎","🤔","🙏","👍","🔥","💯","🎉","😭","😴","🤝","💜","☕","🍕","🚀","✨","❤️"];

function ChatPage() {
  const { contactId } = Route.useParams();
  const navigate = useNavigate();
  const contact = useMemo(() => CONTACTS.find((c) => c.id === contactId), [contactId]);

  const [messages, setMessages] = useState<Message[]>(() => loadFor(contactId));
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [typing, setTyping] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);

  useEffect(() => {
    setUnread(contactId, 0);
  }, [contactId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  if (!contact) {
    return (
      <div className="grid h-[100dvh] place-items-center p-6 text-center">
        <div>
          <p className="text-muted-foreground">Contact not found.</p>
          <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
        </div>
      </div>
    );
  }

  function send() {
    const value = text.trim();
    if (!value) return;
    const msg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: value,
      from: "out",
      ts: Date.now(),
    };
    appendMessage(contactId, msg);
    setMessages((m) => [...m, msg]);
    setText("");
    setShowEmoji(false);

    // simulate reply (skip for "myself")
    if (contactId === "myself") return;
    setTyping(true);
    window.setTimeout(() => {
      const reply: Message = {
        id: `${Date.now()}-r-${Math.random().toString(36).slice(2, 7)}`,
        text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
        from: "in",
        ts: Date.now(),
      };
      appendMessage(contactId, reply);
      bumpUnread(contactId);
      // immediately mark read since user is in chat
      setUnread(contactId, 0);
      setMessages((m) => [...m, reply]);
      setTyping(false);
    }, 1500);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  function startPress(id: string) {
    pressTimer.current = window.setTimeout(() => setMenuFor(id), 450);
  }
  function endPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function copyMsg(m: Message) {
    navigator.clipboard?.writeText(m.text);
    setMenuFor(null);
  }
  function removeMsg(m: Message) {
    deleteMessage(contactId, m.id);
    setMessages((arr) => arr.filter((x) => x.id !== m.id));
    setMenuFor(null);
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 bg-background/95 px-3 pt-5 pb-3 backdrop-blur">
        <button
          onClick={() => navigate({ to: "/" })}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative">
          <div className={`grid h-10 w-10 place-items-center rounded-full ${contact.color} text-xs font-semibold text-white`}>
            {contact.initials}
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-background bg-online" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold leading-tight">{contact.name}</h1>
          <p className="text-[11px] text-online">Online</p>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="no-scrollbar flex-1 overflow-y-auto px-3 py-4"
        onClick={() => setMenuFor(null)}
      >
        <div className="flex flex-col gap-2">
          {messages.map((m) => {
            const out = m.from === "out";
            return (
              <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div className="relative max-w-[78%]">
                  <div
                    onMouseDown={() => startPress(m.id)}
                    onMouseUp={endPress}
                    onMouseLeave={endPress}
                    onTouchStart={() => startPress(m.id)}
                    onTouchEnd={endPress}
                    onContextMenu={(e) => { e.preventDefault(); setMenuFor(m.id); }}
                    className={`animate-message-in select-none rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                      out
                        ? "rounded-br-md bg-bubble-out text-bubble-out-foreground"
                        : "rounded-bl-md bg-bubble-in text-bubble-in-foreground"
                    }`}
                  >
                    {m.text}
                    <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${out ? "text-white/75" : "text-muted-foreground"}`}>
                      <span>{formatTime(m.ts)}</span>
                      {out && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>
                  {menuFor === m.id && (
                    <div className={`absolute z-10 mt-1 ${out ? "right-0" : "left-0"} flex overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl`}>
                      <button onClick={() => copyMsg(m)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-card">
                        <Copy className="h-4 w-4" /> Copy
                      </button>
                      <button onClick={() => removeMsg(m)} className="flex items-center gap-2 border-l border-border px-3 py-2 text-sm text-destructive hover:bg-card">
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-bubble-in px-4 py-3">
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showEmoji && (
        <div className="grid grid-cols-10 gap-1 border-t border-border bg-card px-3 py-3">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setText((t) => t + e)}
              className="rounded-lg py-1 text-xl transition hover:bg-background"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border bg-background px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          onClick={() => setShowEmoji((s) => !s)}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
            showEmoji ? "bg-primary/15 text-primary" : "bg-card text-muted-foreground"
          }`}
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message"
          className="min-w-0 flex-1 rounded-full bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
          aria-label="Send"
        >
          <Send className="h-[18px] w-[18px] -translate-x-[1px]" />
        </button>
      </div>
    </div>
  );
}
