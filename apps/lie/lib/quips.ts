/**
 * The machine talking back.
 *
 * Which line you get depends on how the run is going rather than only on
 * whether this answer was right: a streak earns grudging sarcasm, a run of
 * misses wears its patience down, losing a long streak gets its own send-off,
 * and being wrong after spending a hint is noticed.
 */

type Tier = Record<string, string[]>;

export const QUIPS: { right: Tier; wrong: Tier } = {
  "right": {
    "plain": [
      "Correct. Even a stopped clock.",
      "Right. I'll put that down to skill, shall I.",
      "Yes. Try not to let it go to your head.",
      "Correct. One in four, but well done.",
      "Right. Nobody is more surprised than me.",
      "Correct. Bank that feeling, it may not last.",
      "Yes. Beginner's luck still counts as luck.",
      "Right. Don't get comfortable.",
      "Correct, after a long and thoughtful stare.",
      "Yes. I'd have picked that one too, if I were being honest."
    ],
    "warm": [
      "Right again. This is getting suspicious.",
      "Correct. Somebody has been reading.",
      "Yes. I am revising my opinion of you upward. Slightly.",
      "Right. Fine. You are good at this. There, it is said.",
      "Correct. You are making my lies look amateur."
    ],
    "hot": [
      "Still going. I am running out of lies you will fall for.",
      "Correct. Again. This stopped being funny a while ago.",
      "Right. I would accuse you of looking it up, but you are too quick.",
      "Yes. Show-off.",
      "Correct. I hope this is the highlight of your week."
    ],
    "recover": [
      "There you go. I was beginning to worry.",
      "Correct. Back from the dead.",
      "Right, finally. We got there in the end."
    ]
  },
  "wrong": {
    "plain": [
      "No. That one is real. So is your confidence.",
      "Wrong. Bold, though.",
      "No. Three of them were true and you found none of them.",
      "Wrong. That is the one I would pick if I wanted to be wrong.",
      "No. A coin would be doing better.",
      "Wrong. Don't worry, nobody saw.",
      "No. You have just called a real fact a liar.",
      "Wrong. Confidently wrong is still wrong.",
      "No. The invented one was right there in front of you.",
      "Wrong. I would explain, but you would only argue."
    ],
    "again": [
      "Wrong again. A pattern is forming and it is not flattering.",
      "No. Two in a row. Shall I make them easier?",
      "Wrong. I am not even trying very hard.",
      "No. You are picking the prettiest sentence, aren't you.",
      "Wrong. Again. The machine thanks you for your service."
    ],
    "dire": [
      "No. This is a speedrun of being wrong.",
      "Wrong. I could tell you the answer first and you would still find a way.",
      "No. Honestly, impressive. Nobody is this consistent by accident.",
      "Wrong. Have you tried picking the opposite of whatever you think?",
      "No. I am writing these for an audience of one, and it shows."
    ],
    "fall": [
      "And there goes the streak.",
      "No. Pride, meet fall.",
      "Wrong. You were doing so well. Were."
    ],
    "hint": [
      "Wrong, and you spent a hint on it. Let that sit.",
      "No. With help. Three to choose from and you still found the wrong one."
    ]
  }
};

export const QUESTIONS: string[] = [
  "Three of these are true. Which one did the machine make up?",
  "One of these never happened. Which?",
  "Three are real. Find the invention.",
  "Which of these is not true?",
  "Three checked out. One did not. Which?"
];

/** Picks the tier, then a line from it that has not been used recently. */
export function pickQuip(
  kind: "right" | "wrong",
  tier: string,
  recent: string[],
): string {
  const pool = QUIPS[kind][tier] ?? QUIPS[kind].plain;
  const fresh = pool.filter((line) => !recent.includes(line));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

export function tierFor(
  right: boolean,
  opts: { streak: number; missBefore: number; streakBefore: number; miss: number; usedHint: boolean },
): string {
  if (right) {
    if (opts.streak >= 6) return "hot";
    if (opts.streak >= 3) return "warm";
    return opts.missBefore >= 2 ? "recover" : "plain";
  }
  if (opts.usedHint) return "hint";
  if (opts.streakBefore >= 3) return "fall";
  if (opts.miss >= 4) return "dire";
  return opts.miss >= 2 ? "again" : "plain";
}
