import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Send, Smile, Paperclip, Mic, X, Reply, Check, CheckCheck,
  Settings, Pencil, Trash2, ChevronLeft, Play, Pause,
  Loader2, ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/chat-utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Pocket Chat Bro" }] }),
  component: ChatPage,
});

type Profile = {
  id: string; username: string; display_name: string | null;
  avatar_base64: string | null; is_online: boolean | null; last_seen: string | null;
};

type Message = {
  id: string; sender_id: string; content: string | null;
  type: string; reply_to: string | null; is_edited: boolean;
  is_deleted: boolean; deleted_for: string[]; is_read: boolean; created_at: string;
};

type Reaction = {
  id: string; message_id: string; user_id: string; emoji: string;
};

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const REACT_EMOJIS = ["👍", "❤️", "😂"];
const MAX_IMAGE_SIZE = 500 * 1024;
const MAX_VOICE_SECONDS = 60;

function ChatPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: Message } | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [tabUnread, setTabUnread] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingRef = useRef(0);
  const notifSoundRef = useRef<HTMLAudioElement | null>(null);

  // Init
  useEffect(() => {
    notifSoundRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/gH9/f3+AgH9/f3+AgH+AgICAgICAgICAf39/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/gH+AgH+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/gH+AgH+AgH+AgH+AgH9/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH9/f3+AgH9/f3+AgH+AgH9/f3+AgH+AgH+AgH+AgH+AgH9/f38=");
    notifSoundRef.current.volume = 0.3;
  }, []);

  // Load initial data
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user || !active) return;
      setMe(userRes.user.id);

      const { data: soundPref } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userRes.user.id)
        .single();
      if (soundPref) setSoundEnabled(true);

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*");
      const other = (allProfiles ?? []).find((p: Profile) => p.id !== userRes.user.id);
      if (other) setOtherUser(other);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);

      const { data: reacts } = await supabase
        .from("reactions")
        .select("*");
      setReactions(reacts ?? []);

      setLoading(false);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .neq("sender_id", userRes.user.id)
        .eq("is_read", false);

      await supabase
        .from("profiles")
        .update({ is_online: true })
        .eq("id", userRes.user.id);
    })();
    return () => { active = false; };
  }, []);

  // Online status on unload
  useEffect(() => {
    const handleUnload = () => {
      if (me) {
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL?.replace("/rest/v1/", "/rest/v1/rpc/update_last_seen")}`,
          JSON.stringify({ id: me })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [me]);

  // Set offline when leaving
  useEffect(() => {
    return () => {
      if (me) {
        supabase.from("profiles").update({ is_online: false, last_seen: new Date().toISOString() }).eq("id", me).then();
      }
    };
  }, [me]);

  // Realtime subscriptions
  useEffect(() => {
    if (!me) return;

    const msgChannel = supabase
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== me && !m.is_deleted && notifSoundRef.current && soundEnabled) {
          notifSoundRef.current.currentTime = 0;
          notifSoundRef.current.play().catch(() => {});
          setTabUnread((u) => u + 1);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        const old = payload.old as Message;
        setMessages((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    const reactChannel = supabase
      .channel("reactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
        supabase.from("reactions").select("*").then(({ data }) => setReactions(data ?? []));
      })
      .subscribe();

    const typingChannel = supabase
      .channel("typing")
      .on("postgres_changes", { event: "*", schema: "public", table: "typing_status" }, (payload) => {
        const row = (payload.new ?? payload.old) as { user_id: string; is_typing: boolean; updated_at: string } | null;
        if (!row || row.user_id === me) return;
        const fresh = Date.now() - new Date(row.updated_at).getTime() < 4000;
        setOtherTyping(payload.eventType !== "DELETE" && row.is_typing && fresh);
      })
      .subscribe();

    const profileChannel = supabase
      .channel("profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as Profile;
        if (p.id !== me) setOtherUser((prev) => prev ? { ...prev, ...p } : prev);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(reactChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [me, soundEnabled]);

  // Tab title unread badge
  useEffect(() => {
    if (tabUnread > 0) {
      document.title = `(${tabUnread}) Pocket Chat Bro`;
    } else {
      document.title = "Pocket Chat Bro";
    }
  }, [tabUnread]);

  // Reset unread on focus
  useEffect(() => {
    const onFocus = () => setTabUnread(0);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Auto-scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, otherTyping]);

  // Send typing indicator
  async function sendTyping() {
    if (!me) return;
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;
    await supabase.from("typing_status").upsert({
      user_id: me,
      is_typing: true,
      updated_at: new Date().toISOString(),
    });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      supabase.from("typing_status").upsert({
        user_id: me,
        is_typing: false,
        updated_at: new Date().toISOString(),
      }).then();
    }, 3000);
  }

  // Send message
  async function send() {
    const value = text.trim();
    if (!value || !me) return;
    setText("");
    setShowEmoji(false);

    const msg: Partial<Message> = {
      sender_id: me,
      content: value,
      type: "text",
      reply_to: replyTo?.id ?? null,
      is_edited: false,
      is_deleted: false,
      deleted_for: [],
      is_read: false,
    };

    const { error } = await supabase.from("messages").insert(msg);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReplyTo(null);

    supabase.from("typing_status").upsert({
      user_id: me,
      is_typing: false,
      updated_at: new Date().toISOString(),
    }).then();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editingId) { saveEdit(); return; }
      send();
    }
  }

  // Edit message
  async function saveEdit() {
    if (!editingId || !text.trim() || !me) return;
    const { error } = await supabase
      .from("messages")
      .update({ content: text.trim(), is_edited: true })
      .eq("id", editingId)
      .eq("sender_id", me);
    if (error) toast.error(error.message);
    setEditingId(null);
    setText("");
  }

  // Context menu
  function handleContextMenu(e: React.MouseEvent, msg: Message) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msg });
  }

  function handleTouchStart(msg: Message) {
    const timer = setTimeout(() => {
      setShowReactions(null);
      setContextMenu({ x: 0, y: 300, msg });
    }, 500);
    const clear = () => { clearTimeout(timer); };
    window.addEventListener("touchend", clear, { once: true });
    window.addEventListener("touchmove", clear, { once: true });
  }

  // Delete for Me
  async function deleteForMe(msg: Message) {
    if (!me) return;
    const curr = msg.deleted_for || [];
    if (curr.includes(me)) return;
    await supabase
      .from("messages")
      .update({ deleted_for: [...curr, me] })
      .eq("id", msg.id);
    setContextMenu(null);
  }

  // Delete for Everyone
  async function deleteForEveryone(msg: Message) {
    await supabase
      .from("messages")
      .update({ is_deleted: true, content: "" })
      .eq("id", msg.id);
    setContextMenu(null);
  }

  // Reactions
  async function toggleReaction(msgId: string, emoji: string) {
    if (!me) return;
    const existing = reactions.find((r) => r.message_id === msgId && r.user_id === me && r.emoji === emoji);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: msgId, user_id: me, emoji });
    }
    setShowReactions(null);
  }

  function getReactions(msgId: string) {
    return reactions.filter((r) => r.message_id === msgId);
  }

  // Image upload
  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be under 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      const { error } = await supabase.from("messages").insert({
        sender_id: me,
        content: b64,
        type: "image",
        reply_to: replyTo?.id ?? null,
      });
      if (error) toast.error(error.message);
      setReplyTo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Voice recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setRecording(true);
      setRecordingDuration(0);

      const durationInterval = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= MAX_VOICE_SECONDS - 1) {
            clearInterval(durationInterval);
            stopRecording();
          }
          return d + 1;
        });
      }, 1000);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        clearInterval(durationInterval);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = reader.result as string;
          if (!me) return;
          const { error } = await supabase.from("messages").insert({
            sender_id: me,
            content: b64,
            type: "audio",
            reply_to: replyTo?.id ?? null,
          });
          if (error) toast.error(error.message);
          setReplyTo(null);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close, { once: true });
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // Filter messages visible to current user
  const visibleMessages = messages.filter((m) => {
    if (!me) return false;
    const df = m.deleted_for || [];
    return !df.includes(me);
  });

  function isOwn(msg: Message) {
    return msg.sender_id === me;
  }

  function getMsgById(id: string | null) {
    if (!id) return null;
    return messages.find((m) => m.id === id);
  }

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex items-center gap-3 border-b border-border/60 px-3 pt-5 pb-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-card" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-card" />
          <div className="flex-1">
            <div className="h-4 w-24 animate-pulse rounded bg-card" />
            <div className="mt-1 h-3 w-16 animate-pulse rounded bg-card" />
          </div>
          <div className="h-9 w-9 animate-pulse rounded-full bg-card" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <div className={`h-12 animate-pulse rounded-2xl bg-card ${i % 2 === 0 ? "w-48" : "w-36"}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 px-3 pt-5 pb-2.5">
        <div className="relative shrink-0">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-card text-sm font-semibold text-white">
            {otherUser?.avatar_base64 ? (
              <img src={otherUser.avatar_base64} alt="" className="h-full w-full object-cover" />
            ) : (
              (otherUser?.display_name ?? otherUser?.username ?? "U").slice(0, 2).toUpperCase()
            )}
          </div>
          {otherUser?.is_online && (
            <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-background bg-online" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold leading-tight">
            {otherUser?.display_name ?? otherUser?.username ?? "Chat"}
          </h1>
          <p className="text-[11.5px] text-muted-foreground">
            {otherTyping ? (
              <span className="text-primary">typing...</span>
            ) : otherUser?.is_online ? (
              <span className="text-online">online</span>
            ) : otherUser?.last_seen ? (
              `Last seen today at ${formatTime(otherUser.last_seen)}`
            ) : (
              "offline"
            )}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-card"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollerRef} className="no-scrollbar flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-col gap-[3px]">
          {visibleMessages.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-20">
              <p className="text-center text-sm text-muted-foreground">
                No messages yet. Say hi! 👋
              </p>
            </div>
          )}

          {visibleMessages.map((m, i) => {
            const out = isOwn(m);
            const prev = visibleMessages[i - 1];
            const sameAsPrev = prev && prev.sender_id === m.sender_id;
            const msgReactions = getReactions(m.id);
            const replyMsg = getMsgById(m.reply_to);
            const showDate = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();

            return (
              <div key={m.id}>
                {showDate && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-card/80 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                      {new Date(m.created_at).toLocaleDateString([], {
                        weekday: "long", month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${out ? "justify-end" : "justify-start"} ${sameAsPrev ? "mt-[2px]" : "mt-1.5"}`}
                  onContextMenu={(e) => handleContextMenu(e, m)}
                  onTouchStart={() => handleTouchStart(m)}
                >
                  <div
                    className={`animate-message-in group relative max-w-[80%] px-3 py-1.5 text-[15px] leading-snug shadow-sm ${
                      out
                        ? "bg-bubble-out text-bubble-out-foreground rounded-2xl rounded-br-[6px]"
                        : "bg-bubble-in text-bubble-in-foreground rounded-2xl rounded-bl-[6px]"
                    }`}
                  >
                    {/* Reply quote */}
                    {replyMsg && (
                      <div className="mb-1 flex items-center gap-1.5 border-l-[3px] border-primary/60 pl-2">
                        <div className="text-[11px] opacity-70">
                          <span className="font-medium">
                            {replyMsg.sender_id === me ? "You" : otherUser?.display_name ?? otherUser?.username}
                          </span>
                          <p className="truncate text-[12px]">
                            {replyMsg.is_deleted ? "Message deleted" : replyMsg.content?.slice(0, 60)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Deleted message */}
                    {m.is_deleted ? (
                      <p className="italic text-muted-foreground">
                        {out ? "You deleted this message" : "This message was deleted"}
                      </p>
                    ) : m.type === "image" && m.content ? (
                      <button
                        onClick={() => setLightbox(m.content!)}
                        className="block overflow-hidden rounded-lg"
                      >
                        <img
                          src={m.content}
                          alt="Image"
                          className="max-h-48 w-auto max-w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : m.type === "audio" && m.content ? (
                      <AudioPlayer src={m.content} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    )}

                    {/* Reactions */}
                    {msgReactions.length > 0 && (
                      <div className={`-mb-1 mt-0.5 flex flex-wrap gap-0.5 ${out ? "justify-end" : "justify-start"}`}>
                        {Array.from(new Set(msgReactions.map((r) => r.emoji))).map((emoji) => {
                          const count = msgReactions.filter((r) => r.emoji === emoji).length;
                          return (
                            <span key={emoji} className="rounded-full bg-black/20 px-1 text-[11px] leading-none">
                              {emoji} {count > 1 ? count : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer: time + edit label + read receipts */}
                    <div className={`-mt-0.5 flex items-center justify-end gap-1 text-[10.5px] ${
                      out ? "text-white/75" : "text-muted-foreground"
                    }`}>
                      <span>{formatTime(m.created_at)}</span>
                      {m.is_edited && !m.is_deleted && <span className="text-[9px]">edited</span>}
                      {out && !m.is_deleted && (
                        m.is_read ? (
                          <CheckCheck className="h-3.5 w-3.5 text-[#FF6B35]" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )
                      )}
                    </div>

                    {/* Reaction overlay (hover) */}
                    {!m.is_deleted && (
                      <div className={`absolute -top-4 hidden gap-0.5 rounded-full bg-card px-1.5 py-1 shadow-lg group-hover:flex ${
                        out ? "right-0" : "left-0"
                      }`}>
                        {REACT_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={(e) => { e.stopPropagation(); toggleReaction(m.id, emoji); }}
                            className="rounded-full p-0.5 text-sm transition hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {otherTyping && (
            <div className="mt-1.5 flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-[6px] bg-bubble-in px-4 py-3">
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2">
          <Reply className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium text-primary text-xs">
              Replying to {replyTo.sender_id === me ? "yourself" : otherUser?.display_name ?? otherUser?.username}
            </p>
            <p className="truncate text-muted-foreground text-xs">
              {replyTo.is_deleted ? "Message deleted" : replyTo.content}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Edit indicator */}
      {editingId && (
        <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2">
          <Pencil className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm text-muted-foreground">Editing message</span>
          <button
            onClick={() => { setEditingId(null); setText(""); }}
            className="ml-auto shrink-0 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Emoji picker */}
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

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-border bg-background px-3 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button
          onClick={() => fileRef.current?.click()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-muted-foreground transition hover:text-foreground"
          aria-label="Attach"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

        <button
          onClick={() => setShowEmoji((s) => !s)}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
            showEmoji ? "bg-primary/15 text-primary" : "bg-card text-muted-foreground"
          }`}
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>

        {recording ? (
          <div className="flex flex-1 items-center gap-3 rounded-full bg-destructive/10 px-4 py-2.5">
            <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
            <span className="font-mono text-sm tabular-nums text-destructive">
              {String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:
              {String(recordingDuration % 60).padStart(2, "0")}
            </span>
            <button
              onClick={stopRecording}
              className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-destructive text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!editingId) sendTyping();
            }}
            onKeyDown={onKeyDown}
            placeholder="Message"
            className="min-w-0 flex-1 rounded-full bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
          />
        )}

        {text.trim() || editingId ? (
          <button
            onClick={editingId ? saveEdit : send}
            disabled={!text.trim()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
            aria-label="Send"
          >
            {editingId ? (
              <Check className="h-[18px] w-[18px]" />
            ) : (
              <Send className="h-[18px] w-[18px] -translate-x-[1px]" />
            )}
          </button>
        ) : (
          <button
            onMouseDown={startRecording}
            onTouchStart={startRecording}
            onMouseUp={stopRecording}
            onTouchEnd={stopRecording}
            onMouseLeave={stopRecording}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-muted-foreground transition hover:text-primary"
            aria-label="Voice message"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-52 animate-fade-in rounded-xl bg-card py-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              setReplyTo(contextMenu.msg);
              inputRef.current?.focus();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-muted"
          >
            <Reply className="h-4 w-4" /> Reply
          </button>
          {isOwn(contextMenu.msg) && contextMenu.msg.type === "text" && !contextMenu.msg.is_deleted && (
            <button
              onClick={() => {
                setEditingId(contextMenu.msg.id);
                setText(contextMenu.msg.content ?? "");
                setContextMenu(null);
                inputRef.current?.focus();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-muted"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          <button
            onClick={() => deleteForMe(contextMenu.msg)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-muted"
          >
            <Trash2 className="h-4 w-4" /> Delete for Me
          </button>
          {isOwn(contextMenu.msg) && (
            <button
              onClick={() => deleteForEveryone(contextMenu.msg)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive transition hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete for Everyone
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <img src={lightbox} alt="Full size" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

// Audio Player Component
function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrent(audio.currentTime);
    audio.onended = () => setPlaying(false);
    return () => { audio.pause(); audio.src = ""; };
  }, [src]);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  }

  function format(d: number) {
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button
        onClick={toggle}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-white"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white/70 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className="text-[11px] tabular-nums opacity-70">
        {format(current)} / {format(duration)}
      </span>
    </div>
  );
}
