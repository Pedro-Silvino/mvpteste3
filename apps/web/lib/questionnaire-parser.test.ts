import { describe, expect, it } from "vitest";
import { MAX_QUESTIONS, parseQuestionnaire } from "./questionnaire-parser";

describe("parseQuestionnaire - JSON", () => {
  it("reads an array of objects with common key names", () => {
    const r = parseQuestionnaire("json", JSON.stringify([{ id: "Q1", pergunta: "Usa MFA?" }, { numero: 2, question: "Faz backup?" }]));
    expect(r).toEqual({ ok: true, questions: [{ id: "Q1", text: "Usa MFA?" }, { id: "2", text: "Faz backup?" }] });
  });
  it("accepts { questions: [...] } and plain strings", () => {
    const r = parseQuestionnaire("json", JSON.stringify({ questions: ["A empresa faz backup?", "Há política?"] }));
    expect(r.ok && r.questions.map((q) => q.id)).toEqual(["1", "2"]);
  });
  it("rejects invalid JSON and empty lists", () => {
    expect(parseQuestionnaire("json", "{oops").ok).toBe(false);
    expect(parseQuestionnaire("json", "[]").ok).toBe(false);
  });
});

describe("parseQuestionnaire - CSV", () => {
  it("reads header, comma or semicolon, quotes and accents", () => {
    const csv = 'id;pergunta\r\nS1;"A empresa usa MFA, em todos os acessos?"\r\nS2;Há plano de continuidade?\r\n';
    const r = parseQuestionnaire("csv", csv);
    expect(r).toEqual({
      ok: true,
      questions: [
        { id: "S1", text: "A empresa usa MFA, em todos os acessos?" },
        { id: "S2", text: "Há plano de continuidade?" },
      ],
    });
  });
  it("handles escaped quotes and a BOM", () => {
    const r = parseQuestionnaire("csv", '﻿id,question\n1,"Diga ""sim"" ou não: há backup?"');
    expect(r.ok && r.questions[0].text).toBe('Diga "sim" ou não: há backup?');
  });
  it("without header, uses the first column as the text", () => {
    const r = parseQuestionnaire("csv", "Faz backup externo?\nUsa antivírus?");
    expect(r.ok && r.questions).toEqual([
      { id: "1", text: "Faz backup externo?" },
      { id: "2", text: "Usa antivírus?" },
    ]);
  });
});

describe("parseQuestionnaire - limits and safety", () => {
  it("caps the number of questions and the text length, and strips control characters", () => {
    const many = Array.from({ length: MAX_QUESTIONS + 5 }, (_, i) => `Pergunta ${i} sobre backup?`);
    const r = parseQuestionnaire("json", JSON.stringify(many));
    expect(r.ok).toBe(false);
    const long = parseQuestionnaire("json", JSON.stringify(["x".repeat(5000) + "\u0000\u0007"]));
    expect(long.ok && long.questions[0].text.length).toBe(1000);
    expect(long.ok && /[\u0000-\u0008]/.test(long.questions[0].text)).toBe(false);
  });
  it("rejects oversized content and unknown formats", () => {
    expect(parseQuestionnaire("csv", "a".repeat(300_000)).ok).toBe(false);
    expect(parseQuestionnaire("xml" as never, "<a/>").ok).toBe(false);
  });
  it("drops duplicate ids by renumbering the repeats", () => {
    const r = parseQuestionnaire("json", JSON.stringify([{ id: "A", text: "Um?" }, { id: "A", text: "Dois?" }]));
    expect(r.ok && r.questions.map((q) => q.id)).toEqual(["A", "A-2"]);
  });
});
