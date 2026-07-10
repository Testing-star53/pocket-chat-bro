import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Pocket Chat Bro" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (clean.length < 3) {
          toast.error("Username must be at least 3 characters");
          setLoading(false);
          return;
        }
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: clean, full_name: clean },
          },
        });
        if (signUpErr) throw signUpErr;

        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr && !signInErr.message?.includes("Email not confirmed")) throw signInErr;

        toast.success("Welcome to Pocket Chat Bro!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/40">
          <MessageCircle className="h-8 w-8" strokeWidth={2.5} />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Pocket <span className="text-primary">Chat Bro</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Private messaging for two</p>
      </div>

      <form onSubmit={handleEmail} className="flex w-full max-w-sm flex-col gap-3">
        {mode === "signup" && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            minLength={3}
            className="rounded-xl bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-xl bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          className="rounded-xl bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          disabled={loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-6 text-sm text-muted-foreground"
      >
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <span className="font-semibold text-primary">
          {mode === "signin" ? "Create an account" : "Sign in"}
        </span>
      </button>
    </div>
  );
}
