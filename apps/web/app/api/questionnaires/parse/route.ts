import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_CONTENT_CHARS, parseQuestionnaire } from "@/lib/questionnaire-parser";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.strictObject({
  format: z.enum(["json", "csv"]),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
});

// Turns a pasted or uploaded questionnaire into a list of questions. Signed-in users only; nothing is stored.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_CONTENT_CHARS * 4 + 1000) {
    return NextResponse.json({ error: "Pedido grande demais." }, { status: 413 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Envie o formato (json ou csv) e o conteúdo." }, { status: 400 });

  const result = parseQuestionnaire(body.data.format, body.data.content);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ questions: result.questions });
}
