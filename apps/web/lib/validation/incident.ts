import { z } from "zod";

// Same limits as public.incidents.description (5..2000) and the SOS form.
export const incidentSchema = z.object({
  description: z
    .string()
    .trim()
    .min(5, "Conte em poucas palavras o que aconteceu (mínimo 5 caracteres).")
    .max(2000, "Texto muito longo (máximo 2000 caracteres)."),
});

// What to do in the first minutes. Generic on purpose: it never promises an outcome.
export const FIRST_STEPS = [
  "Se um computador mostra tela de resgate ou se comporta de forma estranha, desconecte-o da rede (cabo e Wi-Fi), mas não o desligue nem o formate.",
  "Não pague nada e não responda mensagens dos golpistas antes de falar com a equipe.",
  "Avise o responsável pela segurança da empresa e anote o horário e o que foi visto.",
  "Troque, de outro aparelho, a senha das contas que possam ter sido expostas (e-mail primeiro).",
  "Se houver seguro cyber, confira com o corretor o prazo para avisar a seguradora.",
  "Se dados pessoais podem ter vazado, a empresa precisa avaliar a comunicação à ANPD e aos titulares. A equipe ajuda a registrar o que ocorreu.",
] as const;
