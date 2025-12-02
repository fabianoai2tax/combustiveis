import { createClient } from "@/lib/supabase/server";
import { ClientesTable } from "@/components/clientes-table";
import { ClientesHeaderActions } from "@/components/clientes-header-actions";

export default async function PostosGasolinaPage() {
  // 1. Inicializa o cliente do Supabase no contexto do Servidor
  const supabase = await createClient();

  // 2. Busca os dados diretamente aqui (garantindo que a sessão do usuário seja enviada)
  const { data: clientes, error } = await supabase
    .from('postos_gasolina_clientes')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error("Erro ao buscar clientes:", error);
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clientes - Postos de Gasolina</h2>
          <p className="text-muted-foreground">
            Selecione um cliente para ver as empresas vinculadas ou gerenciar contratos.
          </p>
        </div>
        <ClientesHeaderActions />
      </div>
      
      <div className="px-4 lg:px-6">
        {/* Passa os dados ou um array vazio se for null */}
        <ClientesTable data={clientes || []} />
      </div>
    </div>
  );
}