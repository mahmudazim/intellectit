import { z } from "zod";

/** Server action'lar uchun umumiy javob shakli. */
export type ActionState<T = undefined> = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
};

/** Zod xatosini forma maydonlariga moslab qaytaradi. */
export function zodToState<T = undefined>(error: z.ZodError): ActionState<T> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    error: error.issues[0]?.message ?? "Ma'lumot noto'g'ri.",
    fieldErrors,
  };
}

/**
 * O'quvchi uchun eslab qolinadigan, lekin taxmin qilib bo'lmaydigan parol.
 * Chalkashtiradigan belgilar (0/O, 1/l/I) ishlatilmaydi — o'quvchi uni
 * qog'ozdan ko'chirib yozadi.
 */
const SAFE = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

export function generatePassword(): string {
  const pick = (set: string, n: number) =>
    Array.from(
      { length: n },
      () => set[Math.floor(Math.random() * set.length)]
    ).join("");
  return `${pick(SAFE, 4)}${pick(DIGITS, 3)}`;
}

/** Ism va tug'ilgan yildan login yasaydi: "Aziz Karimov" + 2009 → "aziz2009" */
export function suggestUsername(fullName: string, suffix?: string): string {
  const base = fullName
    .toLowerCase()
    .replace(/['`']/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)[0] || "oquvchi";
  return `${base}${suffix ?? ""}`.slice(0, 32);
}
