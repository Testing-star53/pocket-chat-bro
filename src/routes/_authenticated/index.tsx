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
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/60 bg-[var(--header)] px-4 pt-5 pb-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Chats</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate({ to: "/new" })}
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
            aria-label="New chat"
          >
            <Plus className="h-[22px] w-[22px]" />
          </button>
          <Link
            to="/settings"
            className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-[20px] w-[20px]" />
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
            <MessageCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No chats yet.</p>
            <button
              onClick={() => navigate({ to: "/new" })}
              className="mt-4 rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground"
            >
              Start a chat
            </button>
          </div>
        </div>
      ) : (
        <ul className="no-scrollbar flex-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.conversation_id}>
              <Link
                to="/chat/$conversationId"
                params={{ conversationId: r.conversation_id }}
                className="flex items-center gap-3 px-4 py-2.5 transition active:bg-card"
              >
                <div
                  className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full text-[17px] font-semibold text-white ${
                    r.is_ai ? "bg-gradient-to-br from-primary to-sky-400" : colorFor(r.other_username ?? "x")
                  }`}
                >
                  {r.is_ai ? <Sparkles className="h-6 w-6" /> : initials(r.other_name ?? "?")}
                </div>
                <div className="min-w-0 flex-1 border-b border-border/40 pb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex min-w-0 items-center gap-1.5 font-semibold text-[15.5px]">
                      <span className="truncate">{r.other_name}</span>
                      {r.is_ai && (
                        <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                          Bot
                        </span>
                      )}
                    </h2>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                      {r.last_text ? formatRelative(r.last_message_at) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] text-muted-foreground">
                      {r.last_text
                        ? (r.last_sender === me ? "You: " : "") + r.last_text
                        : r.is_ai
                        ? "Your professional AI assistant"
                        : "Say hi 👋"}
                    </p>
                    {r.unread > 0 && (
                      <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
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
