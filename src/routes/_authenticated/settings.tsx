import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { colorFor, initials } from "@/lib/chat-utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ username: string; display_name: string | null } | null>(null);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", data.user.id)
        .single();
      if (p) setProfile(p);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function copyUsername() {
    if (!profile) return;
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopied(true);
    toast.success("Username copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-3 pt-5 pb-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-card">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">Settings</h1>
      </header>

      <div className="flex flex-col items-center gap-3 px-5 py-8">
        <div className={`grid h-20 w-20 place-items-center rounded-full ${colorFor(profile?.username ?? "x")} text-xl font-bold text-white shadow-xl`}>
          {initials(profile?.display_name ?? profile?.username ?? "?")}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{profile?.display_name ?? profile?.username}</p>
          <button
            onClick={copyUsername}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm text-muted-foreground"
          >
            @{profile?.username}
            {copied ? <Check className="h-3.5 w-3.5 text-online" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="px-3">
        <div className="rounded-2xl bg-card p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Pocket AI Bro</p>
              <p className="text-xs text-muted-foreground">
                Tamil + English, translation, grammar, emails, interview prep.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto p-4">
        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive py-3 font-semibold text-destructive-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
