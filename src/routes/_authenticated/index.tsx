import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings, MessageCircle, Plus, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { colorFor, formatRelative, initials } from "@/lib/chat-utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Chats — Pocket Chat Bro" }] }),
  component: ChatListPage,
});

type Row = {
  conversation_id: string;
  is_ai: boolean;
  last_message_at: string;
  last_text: string | null;
  last_sender: string | null;
  unread: number;
  other_name: string | null;
  other_username: string | null;
  other_id: string | null;
};

function ChatListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);

  async function refresh(userId: string) {
    // Ensure AI conversation exists
    await supabase.rpc("get_or_create_ai_conversation");

    // Fetch all my participations + AI-owned convs
    const [{ data: parts }, { data: aiConvs }] = await Promise.all([
      supabase.from("conversation_participants").select("conversation_id").eq("user_id", userId),
      supabase.from("conversations").select("id").eq("ai_owner", userId).eq("is_ai", true),
    ]);
    const convIds = Array.from(
      new Set([...(parts ?? []).map((p) => p.conversation_id), ...(aiConvs ?? []).map((c) => c.id)]),
    );
    if (convIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: convs }, { data: allParts }, { data: msgs }] = await Promise.all([
      supabase.from("conversations").select("*").in("id", convIds),
      supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", convIds),
      supabase
        .from("messages")
        .select("conversation_id, message_text, sender_id, created_at, read_status")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false }),
    ]);

    const otherIds = (allParts ?? [])
      .filter((p) => p.user_id !== userId)
      .map((p) => p.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const profById = new Map((profs ?? []).map((p) => [p.id, p]));

    const lastByConv = new Map<string, { text: string; sender: string | null; created_at: string }>();
    const unreadByConv = new Map<string, number>();
    for (const m of msgs ?? []) {
      if (!lastByConv.has(m.conversation_id)) {
        lastByConv.set(m.conversation_id, { text: m.message_text, sender: m.sender_id, created_at: m.created_at });
      }
      if (!m.read_status && m.sender_id !== userId) {
        unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
      }
    }

    const out: Row[] = (convs ?? []).map((c) => {
      const otherPart = (allParts ?? []).find(
        (p) => p.conversation_id === c.id && p.user_id !== userId,
      );
      const prof = otherPart ? profById.get(otherPart.user_id) : null;
      const last = lastByConv.get(c.id);
      return {
        conversation_id: c.id,
        is_ai: c.is_ai,
        last_message_at: last?.created_at ?? c.last_message_at,
        last_text: last?.text ?? null,
        last_sender: last?.sender ?? null,
        unread: unreadByConv.get(c.id) ?? 0,
        other_name: c.is_ai ? "Pocket AI Bro" : prof?.display_name ?? prof?.username ?? "Unknown",
        other_username: c.is_ai ? "ai" : prof?.username ?? null,
        other_id: c.is_ai ? null : otherPart?.user_id ?? null,
      };
    });

    out.sort((a, b) => {
      // AI pinned to top
      if (a.is_ai !== b.is_ai) return a.is_ai ? -1 : 1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    setRows(out);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      setMe(data.user.id);
      refresh(data.user.id);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refresh(me))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => refresh(me))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me]);

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">
              Pocket <span className="text-primary">Chat Bro</span>
            </h1>
            <p className="text-xs text-muted-foreground">Live messaging</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/new" })}
            className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30"
            aria-label="New chat"
          >
            <Plus className="h-5 w-5" />
          </button>
          <Link
            to="/settings"
            className="grid h-10 w-10 place-items-center rounded-xl bg-card text-muted-foreground transition hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="grid flex-1 place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <p className="text-muted-foreground">No chats yet.</p>
            <button
              onClick={() => navigate({ to: "/new" })}
              className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
            >
              Start a chat
            </button>
          </div>
        </div>
      ) : (
        <ul className="no-scrollbar flex-1 overflow-y-auto px-2 py-2">
          {rows.map((r) => (
            <li key={r.conversation_id}>
              <Link
                to="/chat/$conversationId"
                params={{ conversationId: r.conversation_id }}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 transition active:scale-[0.98] active:bg-card"
              >
                <div
                  className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white shadow-md ${
                    r.is_ai ? "bg-gradient-to-br from-primary to-fuchsia-500" : colorFor(r.other_username ?? "x")
                  }`}
                >
                  {r.is_ai ? <Sparkles className="h-5 w-5" /> : initials(r.other_name ?? "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate font-semibold">
                      {r.other_name}
                      {r.is_ai && <span className="ml-1.5 text-[10px] text-primary">AI</span>}
                    </h2>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {r.last_text ? formatRelative(r.last_message_at) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted-foreground">
                      {r.last_text
                        ? (r.last_sender === me ? "You: " : "") + r.last_text
                        : r.is_ai
                        ? "Ask me anything — Tamil + English"
                        : "Say hi 👋"}
                    </p>
                    {r.unread > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                        {r.unread}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
