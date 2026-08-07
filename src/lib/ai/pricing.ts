/**
 * 1 million token uchun narx (USD).
 * Manba: platform.claude.com/docs/en/pricing va OpenAI narx sahifasi.
 * Narx o'zgarsa shu yerdan yangilanadi — hisob-kitob boshqa joyda takrorlanmaydi.
 */
type Price = { input: number; output: number };

const PRICES: Record<string, Price> = {
  // Anthropic
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  // OpenAI (taxminiy — o'z hisobingizdagi narxga qarab to'g'rilang)
  "gpt-5": { input: 5, output: 25 },
  "gpt-5-mini": { input: 1, output: 5 },
};

const FALLBACK: Price = { input: 5, output: 25 };

/**
 * Xarajatni hisoblaydi. Kesh'dan o'qilgan tokenlar ~10 barobar arzon,
 * shuning uchun alohida hisoblanadi.
 */
export function estimateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  cacheRead = 0
): number {
  const p = PRICES[model] ?? FALLBACK;
  const fresh = Math.max(0, tokensIn - cacheRead);
  const cost =
    (fresh / 1_000_000) * p.input +
    (cacheRead / 1_000_000) * p.input * 0.1 +
    (tokensOut / 1_000_000) * p.output;
  return Number(cost.toFixed(6));
}
