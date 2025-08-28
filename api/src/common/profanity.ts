const defaultWords = ['foo', 'bar']; // placeholder list; override via env

export function getProfanityList(): string[] {
  const env = process.env.PROFANITY_WORDS;
  return env ? env.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) : defaultWords;
}

export function containsProfanity(text?: string): boolean {
  if (!text) return false;
  const words = getProfanityList();
  const lower = text.toLowerCase();
  return words.some((w) => w && lower.includes(w));
}

