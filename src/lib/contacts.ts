export type Contact = {
  id: string;
  name: string;
  color: string; // tailwind bg class
  initials: string;
};

export const CONTACTS: Contact[] = [
  { id: "amma", name: "Amma", color: "bg-rose-500", initials: "AM" },
  { id: "anna", name: "Anna", color: "bg-violet-500", initials: "AN" },
  { id: "bff", name: "Best Friend", color: "bg-emerald-500", initials: "BF" },
  { id: "boss", name: "Work Boss", color: "bg-sky-500", initials: "WB" },
  { id: "myself", name: "Myself", color: "bg-amber-500", initials: "ME" },
];

export const SEED_MESSAGES: Record<string, { text: string; from: "in" | "out" }[]> = {
  amma: [
    { text: "Beta, did you eat?", from: "in" },
    { text: "Yes Amma 🙏", from: "out" },
    { text: "What did you eat?", from: "in" },
    { text: "Pasta. With extra cheese.", from: "out" },
    { text: "Eat some fruit also okay?", from: "in" },
  ],
  anna: [
    { text: "Movie tonight?", from: "in" },
    { text: "What's playing?", from: "out" },
    { text: "That new thriller", from: "in" },
    { text: "I'm in 🍿", from: "out" },
  ],
  bff: [
    { text: "BROOO 😂😂", from: "in" },
    { text: "what happened lol", from: "out" },
    { text: "you won't believe what just happened", from: "in" },
    { text: "spill it", from: "out" },
    { text: "call me when free", from: "in" },
  ],
  boss: [
    { text: "Can you join the standup at 10?", from: "in" },
    { text: "Yes, I'll be there.", from: "out" },
    { text: "Great. Bring the report.", from: "in" },
    { text: "Done ✅", from: "out" },
  ],
  myself: [
    { text: "Remember to pay rent 💸", from: "out" },
    { text: "Also: gym at 6pm", from: "out" },
    { text: "And don't doomscroll tonight", from: "out" },
    { text: "noted self.", from: "out" },
  ],
};

export const AUTO_REPLIES = [
  "lol fr 😭",
  "no way 👀",
  "tell me more",
  "okayyy and?",
  "that's wild",
  "haha you're the best",
  "I'll think about it 🤔",
  "send memes pls",
  "brb getting coffee ☕",
  "you're impossible 😂",
];
