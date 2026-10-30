// Reads a customer questionnaire (JSON or CSV) into a plain list of questions. Pure and bounded: size,
// number of questions and text length are capped, and control characters are removed.
export type ParsedQuestion = { id: string; text: string };
export type ParseResult = { ok: true; questions: ParsedQuestion[] } | { ok: false; error: string };

export const MAX_CONTENT_CHARS = 200_000;
export const MAX_QUESTIONS = 500;
export const MAX_TEXT = 1000;

const ID_KEYS = ["id", "codigo", "numero", "number", "n", "ref", "item"];
const TEXT_KEYS = ["pergunta", "question", "texto", "text", "descricao", "enunciado", "requisito"];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_TEXT);

function finish(rows: { id?: string; text: string }[]): ParseResult {
  const items = rows.map((r) => ({ id: r.id ? clean(r.id).slice(0, 40) : "", text: clean(r.text) })).filter((r) => r.text.length > 0);
  if (items.length === 0) return { ok: false, error: "Não encontramos perguntas nesse arquivo." };
  if (items.length > MAX_QUESTIONS) return { ok: false, error: `O questionário tem mais de ${MAX_QUESTIONS} perguntas. Envie em partes.` };
  const seen = new Map<string, number>();
  const questions = items.map((r, i) => {
    const base = r.id || String(i + 1);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { id: n === 1 ? base : `${base}-${n}`, text: r.text };
  });
  return { ok: true, questions };
}

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const [k, v] of Object.entries(obj)) {
    if (keys.includes(norm(k)) && (typeof v === "string" || typeof v === "number") && String(v).trim()) return String(v);
  }
  return undefined;
}

function parseJson(content: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return { ok: false, error: "O JSON não está num formato válido." };
  }
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? ((data as Record<string, unknown>).questions ?? (data as Record<string, unknown>).perguntas) : null;
  if (!Array.isArray(list)) return { ok: false, error: "Esperávamos uma lista de perguntas." };
  const rows = list.flatMap((item): { id?: string; text: string }[] => {
    if (typeof item === "string") return [{ text: item }];
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const text = pick(o, TEXT_KEYS);
      return text ? [{ id: pick(o, ID_KEYS), text }] : [];
    }
    return [];
  });
  return finish(rows);
}

// RFC 4180-style reader: quotes, escaped quotes ("") and line breaks inside quotes.
function readCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c === '"' && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function parseCsv(content: string): ParseResult {
  const text = content.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const header = readCsv(firstLine, delimiter)[0]?.map(norm) ?? [];
  const textCol = header.findIndex((h) => TEXT_KEYS.includes(h));
  if (textCol === -1) {
    // No header: each line is one question.
    return finish(text.split(/\r?\n/).map((l) => ({ text: l.replace(/^"(.*)"$/, "$1") })));
  }
  const idCol = header.findIndex((h) => ID_KEYS.includes(h));
  const rows = readCsv(text, delimiter).slice(1);
  return finish(rows.map((r) => ({ id: idCol >= 0 ? r[idCol] : undefined, text: r[textCol] ?? "" })));
}

export function parseQuestionnaire(format: "json" | "csv", content: string): ParseResult {
  if (typeof content !== "string" || content.length > MAX_CONTENT_CHARS) return { ok: false, error: "O arquivo é grande demais (máximo de 200 mil caracteres)." };
  if (format === "json") return parseJson(content);
  if (format === "csv") return parseCsv(content);
  return { ok: false, error: "Formato não suportado. Use JSON ou CSV." };
}
