import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, Camera, Check, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/chat-utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Pocket Chat Bro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_base64: string | null;
  } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_base64")
        .eq("id", data.user.id)
        .single();
      if (p) {
        setProfile(p);
        setDisplayName(p.display_name ?? "");
      }
    });
  }, []);

  async function saveDisplayName() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", profile.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Display name updated");
    }
    setSaving(false);
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 500 * 1024) {
      toast.error("Image must be under 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_base64: b64 })
        .eq("id", profile.id);
      if (error) {
        toast.error(error.message);
      } else {
        setProfile({ ...profile, avatar_base64: b64 });
        toast.success("Avatar updated");
      }
    };
    reader.readAsDataURL(file);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-3 pt-5 pb-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-card">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">Settings</h1>
      </header>

      <div className="flex flex-col items-center gap-4 px-5 py-8">
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-card text-2xl font-bold text-white shadow-xl"
        >
          {profile?.avatar_base64 ? (
            <img src={profile.avatar_base64} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(profile?.display_name ?? profile?.username ?? "?")
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
            <Camera className="h-6 w-6" />
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        <p className="text-lg font-semibold">{profile?.username}</p>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <label className="text-sm font-medium text-muted-foreground">Display Name</label>
        <div className="flex gap-2">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="min-w-0 flex-1 rounded-xl bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={saveDisplayName}
            disabled={saving || !displayName.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
          >
            <Check className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-6 px-4">
        <label className="flex items-center justify-between rounded-xl bg-card px-4 py-3">
          <span className="text-sm">Notification Sound</span>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`h-6 w-11 rounded-full transition ${
              soundEnabled ? "bg-primary" : "bg-border"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white transition ${
                soundEnabled ? "translate-x-5.5" : "translate-x-0.5"
              }`}
              style={{ transform: soundEnabled ? "translateX(1.375rem)" : "translateX(0.125rem)" }}
            />
          </button>
        </label>
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
