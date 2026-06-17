import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Smile, CheckCheck, Check, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { askAiBro } from "@/lib/ai-bro.functions";
import { colorFor, formatTime, initials } from "@/lib/chat-utils";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  head: () => ({ meta: [{ title: "Chat" }] }),
  component: ChatPage,
});

const EMOJIS = ["😀","😂","🥲","😍","😎","🤔","🙏","👍","🔥","💯","🎉","😭","😴","🤝","💜","☕","🍕","🚀","✨","❤️"];

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  message_text: string;
  is_ai: boolean;
  read_status: boolean;
  created_at: string;
};

type Conv = { id: string; is_ai: boolean; ai_owner: string | null };
type OtherProfile = { id: string; username: string; display_name: string | null };

function ChatPage() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const askAi = useServerFn(askAiBro);

  const [me, setMe] = useState<string | null>(null);
  const [conv, setConv] = useState<Conv | null>(null);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const headerName = useMemo(() => {
    if (!conv) return "";
    if (conv.is_ai) return "Pocket AI Bro";
    return other?.display_name ?? other?.username ?? "Chat";
  }, [conv, other]);

  // Initial load
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user || !active) return;
      setMe(userRes.user.id);

      const { data: c, error: cErr } = await supabase
        .from("conversations")
        .select("id, is_ai, ai_owner")
        .eq("id", conversationId)
        .single();
      if (cErr || !c) {
        toast.error("Conversation not found");
        navigate({ to: "/" });
        return;
      }
      setConv(c);

      if (!c.is_ai) {
        const { data: parts } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", conversationId);
        const otherId = (parts ?? []).find((p) => p.user_id !== userRes.user!.id)?.user_id;
        if (otherId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, username, display_name")
            .eq("id", otherId)
            .single();
          if (prof) setOther(prof);
        }
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
      setLoading(false);

      // Mark unread as read
      await supabase
        .from("messages")
        .update({ read_status: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", userRes.user.id)
        .eq("read_status", false);
    })();
    return () => { active = false; };
  }, [conversationId, navigate]);

  // Realtime: messages + typing + presence
  useEffect(() => {
    if (!me) return;

    const msgChannel = supabase
      .channel(`msgs:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== me) {
            supabase.from("messages").update({ read_status: true }).eq("id", m.id).then();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_status", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { user_id: string; updated_at: string } | null;
          if (!row || row.user_id === me) return;
          const fresh = Date.now() - new Date(row.updated_at).getTime() < 4000;
          setOtherTyping(payload.eventType !== "DELETE" && fresh);
        },
      )
      .subscribe();

    // Presence
    const presenceChannel = supabase.channel(`presence:${conversationId}`, {
      config: { presence: { key: me } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = Object.keys(state);
        setOtherOnline(onlineIds.some((id) => id !== me));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await presenceChannel.track({ at: Date.now() });
      });

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [conversationId, me]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, otherTyping, aiThinking]);

  async function sendTyping() {
    if (!me || !conv || conv.is_ai) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    await supabase
      .from("typing_status")
      .upsert({ conversation_id: conversationId, user_id: me, updated_at: new Date().toISOString() });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      supabase
        .from("typing_status")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", me)
        .then();
    }, 3500);
  }

  async function send() {
    const value = text.trim();
    if (!value || !me || !conv) return;
    setText("");
    setShowEmoji(false);

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: me,
      message_text: value,
      read_status: false,
      is_ai: false,
    });
    if (error) {
      toast.error(error.message);
      return;
    }

    if (conv.is_ai) {
      setAiThinking(true);
      try {
        await askAi({ data: { conversationId, userMessage: value } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI failed");
      } finally {
        setAiThinking(false);
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  if (loading || !conv) {
    return (
      <div className="grid h-[100dvh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 bg-background/95 px-3 pt-5 pb-3 backdrop-blur">
        <Link
          to="/"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative">
          <div
            className={`grid h-10 w-10 place-items-center rounded-full text-xs font-semibold text-white ${
              conv.is_ai ? "bg-gradient-to-br from-primary to-fuchsia-500" : colorFor(other?.username ?? "x")
            }`}
          >
            {conv.is_ai ? <Sparkles className="h-5 w-5" /> : initials(other?.display_name ?? other?.username ?? "?")}
          </div>
          {(conv.is_ai || otherOnline) && (
            <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-background bg-online" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold leading-tight">{headerName}</h1>
          <p className="text-[11px] text-muted-foreground">
            {otherTyping || aiThinking ? (
              <span className="text-primary">typing…</span>
            ) : conv.is_ai ? (
              "Always available"
            ) : otherOnline ? (
              <span className="text-online">Online</span>
            ) : other ? (
              `@${other.username}`
            ) : (
              ""
            )}
          </p>
        </div>
      </header>

      <div ref={scrollerRef} className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-2">
          {messages.map((m) => {
            const out = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div
                  className={`animate-message-in max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                    out
                      ? "rounded-br-md bg-bubble-out text-bubble-out-foreground"
                      : "rounded-bl-md bg-bubble-in text-bubble-in-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.message_text}</div>
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                      out ? "text-white/75" : "text-muted-foreground"
                    }`}
                  >
                    <span>{formatTime(m.created_at)}</span>
                    {out &&
                      (m.read_status ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })}

          {(otherTyping || aiThinking) && (
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
          onChange={(e) => {
            setText(e.target.value);
            sendTyping();
          }}
          onKeyDown={onKeyDown}
          placeholder={conv.is_ai ? "Ask in Tamil or English…" : "Message"}
          className="min-w-0 flex-1 rounded-full bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={send}
          disabled={!text.trim() || aiThinking}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
          aria-label="Send"
        >
          {aiThinking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-[18px] w-[18px] -translate-x-[1px]" />
          )}
        </button>
      </div>
    </div>
  );
}
