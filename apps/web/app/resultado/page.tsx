import { redirect } from "next/navigation";

// Old entry point: the result now lives inside the dashboard.
export default function ResultadoPage() {
  redirect("/painel");
}
