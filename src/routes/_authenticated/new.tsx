import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Search, Loader2, UserPlus, Share2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { colorFor, initials } from "@/lib/chat-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/new")({
  head: () => ({ meta: [{ title: "New chat" }] }),
  component: NewChatPage,
});

type Profile = { id: string; username: string; display_name: string | null };

function NewChatPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string>("");
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setMe(data.user.id);
      const { data: p } = await supabase.from("profiles").select("username").eq("id", data.user.id).single();
      if (p) setMyUsername(p.username);
    });
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .ilike("username", `%${q.trim().toLowerCase()}%`)
        .limit(20);
      setResults((data ?? []).filter((p) => p.id !== me));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, me]);

  async function startChat(username: string) {
    const { data, error } = await supabase.rpc("start_direct_conversation", {
      _other_username: username,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/chat/$conversationId", params: { conversationId: data as string } });
  }

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/auth?invite=${encodeURIComponent(myUsername)}`
    : "";

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setLinkCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function nativeShare() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Chat with me on Pocket Chat Bro",
          text: `Add me on Pocket Chat Bro. My username is @${myUsername}.`,
          url: inviteUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-3 pt-5 pb-3">
        <Link
          to="/"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1">New chat</h1>
        <button
          onClick={() => setShareOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
          aria-label="Share invite"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 py-3">
        <p className="mb-3 rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">
          Your username: <span className="font-semibold text-foreground">@{myUsername || "..."}</span>
          <br />
          Share it with friends so they can find you.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username"
            className="w-full rounded-xl bg-card py-3 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {loading && (
          <div className="grid place-items-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {!loading && q.trim() && results.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No users found for "{q}"
          </p>
        )}
        <ul>
          {results.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => startChat(p.username)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.98] active:bg-card"
              >
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${colorFor(p.username)} text-sm font-semibold text-white`}>
                  {initials(p.display_name ?? p.username)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.display_name ?? p.username}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                </div>
                <UserPlus className="h-5 w-5 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
