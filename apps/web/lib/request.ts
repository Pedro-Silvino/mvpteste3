import { z } from "zod";

const ip = z.union([z.ipv4(), z.ipv6()]);

// End-user IP as seen by the hosting proxy (Vercel sets x-forwarded-for / x-real-ip).
export function clientIp(headers: Headers): string | null {
  const candidate =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "";
  return ip.safeParse(candidate).success ? candidate : null;
}

const GENERIC = "Não foi possível cadastrar a empresa agora. Tente de novo em alguns minutos.";

// Maps known exceptions from public.create_organization; never echoes database details.
export function createOrgErrorMessage(dbMessage: string | undefined): string {
  if (dbMessage === "limit_orgs") {
    return "Você atingiu o limite de 3 empresas por conta. Fale com a DataDops para cadastrar mais.";
  }
  return GENERIC;
}
