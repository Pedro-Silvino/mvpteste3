import { getPainel } from "@/lib/painel-data";
import { Card, PageHeader } from "../ui";
import { CompanyForm } from "./company-form";
import { PartnerShareCard } from "./partner-share";

export const metadata = { title: "Empresa — Sentinela" };

export default async function EmpresaPage() {
  const p = await getPainel();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Dados da empresa"
        subtitle="Complete os dados quando quiser. Eles aparecem nos relatórios e nos documentos que a equipe prepara para você."
      />
      <Card className="max-w-2xl">
        <CompanyForm
          orgId={p.org.id}
          initial={{
            name: p.org.name,
            cnpj: p.org.cnpj ?? "",
            sector: p.org.sector ?? "",
            employeesRange: p.org.employees_range ?? "",
            domain: p.org.domain ?? "",
          }}
        />
      </Card>
      {p.partner && <PartnerShareCard orgId={p.org.id} partnerName={p.partner.name} shared={p.partner.shared} />}
    </div>
  );
}
