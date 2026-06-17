import { SEED_MESSAGES } from "./contacts";

export type Message = {
  id: string;
  text: string;
  from: "in" | "out";
  ts: number;
};

const KEY = "pcb:chats:v1";
const UNREAD_KEY = "pcb:unread:v1";

type Store = Record<string, Message[]>;
type UnreadStore = Record<string, number>;

const isBrowser = () => typeof window !== "undefined";

function seed(): Store {
  const now = Date.now();
  const out: Store = {};
  Object.entries(SEED_MESSAGES).forEach(([id, msgs]) => {
    out[id] = msgs.map((m, i) => ({
      id: `${id}-seed-${i}`,
      text: m.text,
      from: m.from,
      ts: now - (msgs.length - i) * 1000 * 60 * 7,
    }));
  });
  return out;
}

export function loadAll(): Store {
  if (!isBrowser()) return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as Store;
  } catch {
    return seed();
  }
}

export function saveAll(store: Store) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function loadFor(contactId: string): Message[] {
  return loadAll()[contactId] ?? [];
}

export function appendMessage(contactId: string, msg: Message) {
  const all = loadAll();
  all[contactId] = [...(all[contactId] ?? []), msg];
  saveAll(all);
}

export function clearAll() {
  if (!isBrowser()) return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(UNREAD_KEY);
}

export function deleteMessage(contactId: string, msgId: string) {
  const all = loadAll();
  all[contactId] = (all[contactId] ?? []).filter((m) => m.id !== msgId);
  saveAll(all);
}

export function loadUnread(): UnreadStore {
  if (!isBrowser()) return {};
  try {
    return JSON.parse(localStorage.getItem(UNREAD_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function setUnread(contactId: string, count: number) {
  if (!isBrowser()) return;
  const u = loadUnread();
  if (count <= 0) delete u[contactId];
  else u[contactId] = count;
  localStorage.setItem(UNREAD_KEY, JSON.stringify(u));
}

export function bumpUnread(contactId: string) {
  const u = loadUnread();
  setUnread(contactId, (u[contactId] ?? 0) + 1);
}
