import { z } from "zod";
import base12 from "./base12.json";

export const VENDOR_TOKEN_RE = /^vnd_[a-f0-9]{64}$/;
export const isVendorToken = (t: string) => VENDOR_TOKEN_RE.test(t);

export const VENDOR_OPTIONS = [
  { value: "sim", label: "Sim" },
  { value: "parcial", label: "Em parte" },
  { value: "nao", label: "Não" },
  { value: "nao_sei", label: "Não sei" },
] as const;

export const VENDOR_CONTROLS = base12.controles.map((c) => ({ id: c.id, name: c.nome, question: c.pergunta, help: c.ajuda }));
const IDS = VENDOR_CONTROLS.map((c) => c.id);

// Keys limited to the 12 controls, values to the four answers the database function accepts.
export const vendorAnswersSchema = z.strictObject(
  Object.fromEntries(IDS.map((id) => [id, z.enum(["sim", "parcial", "nao", "nao_sei"]).optional()])) as Record<string, z.ZodOptional<z.ZodEnum<{ sim: "sim"; parcial: "parcial"; nao: "nao"; nao_sei: "nao_sei" }>>>,
);
export type VendorAnswers = z.infer<typeof vendorAnswersSchema>;

export const isComplete = (a: Record<string, string | undefined>) => IDS.every((id) => !!a[id]);

// Upload goes straight from the vendor's browser to the worker (no 4.5 MB Vercel limit); only https is allowed
// outside localhost, and the token and control are checked here so nothing odd is ever put into the URL.
export function workerEvidenceUrl(base: string | undefined, token: string, control: string): string | null {
  if (!base || !isVendorToken(token) || !/^C[0-9]{2}$/.test(control)) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  return `${url.origin}/tprm/vendor/${token}/evidence?control=${control}`;
}
