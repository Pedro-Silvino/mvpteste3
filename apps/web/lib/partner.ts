export const PARTNER_COOKIE = "snt_partner";
export const PARTNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function normalizePartnerCode(value: string | null | undefined): string | null {
  const code = (value ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{2,40}$/.test(code) ? code : null;
}
