import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
// 1. Importe o componente da tabela (verifique se o caminho do arquivo está correto)
import { PostosGasolinaTable } from "@/components/postos-gasolina-table"; 
import { PostosGasolinaDataRow } from "@/types/supabase";

interface ClientePageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientePage({ params }: ClientePageProps) {
  const { clientId } = await params;
  const supabase = await createClient();

  // --- BUSCA DADOS DO CLIENTE ---
  const { data: cliente, error: clienteError } = await supabase
    .from('postos_gasolina_clientes')
    .select('*') // Pegando tudo para garantir que temos os dados para o componente
    .eq('id', clientId)
    .single();

  if (clienteError || !cliente) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-500">Cliente não encontrado</h1>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/clientes">Voltar para Clientes</Link>
        </Button>
      </div>
    );
  }

  // --- BUSCA DADOS DAS EMPRESAS (RPC) ---
  const { data: allData } = await supabase.rpc('get_postos_gasolina_overview');
  
  // Filtra as empresas deste cliente específico
  const postosData = (allData || []).filter((empresa: PostosGasolinaDataRow) => empresa.cliente_id === clientId);

  // --- BUSCA OPÇÕES DE STATUS ---
  const { data: statusOptions } = await supabase
    .from('status')
    .select('*')
    .order('ordem', { ascending: true });

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6 flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/clientes">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar para Clientes
          </Link>
        </Button>
      </div>

      <div className="px-4 lg:px-6">
        <h2 className="text-xl font-semibold">Empresas do Cliente: {cliente.nome}</h2>
        <p className="text-muted-foreground">
          Visão geral de todas as empresas vinculadas a este cliente.
        </p>
      </div>
      
      <div className="px-4 lg:px-6">
        {/* 2. AQUI ESTÁ A TABELA REAL SENDO RENDERIZADA */}
        <PostosGasolinaTable 
          data={postosData} 
          statusOptions={statusOptions || []} 
          cliente={cliente}
        />
      </div>
    </div>
  );
}