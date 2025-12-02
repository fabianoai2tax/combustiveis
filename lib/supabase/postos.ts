import { createClient } from "@/lib/supabase/client";
import { PostosGasolinaCliente, PostosGasolinaDataRow } from "@/types/supabase";

/**
* Busca os dados da visão geral de postos de gasolina usando a função RPC do Supabase.
* Esta função já retorna os dados do cliente, conforme ajustamos anteriormente.
* @returns Uma promessa que resolve para um array de dados de empresas.
*/

export async function getPostosGasolinaData(): Promise<PostosGasolinaDataRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_postos_gasolina_overview');

  if (error) {
    console.error("❌ [Supabase] Erro ao buscar dados de postos de gasolina:", error);
    return [];
  }

  return data || [];
}

// Lista de clientes (id, nome) para a página de seleção de clientes
export async function getClientes(): Promise<PostosGasolinaCliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('postos_gasolina_clientes')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error("Erro ao buscar clientes:", error);
    return [];
  }

  return data || [];
}
    
export async function getStatusOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('status')
    .select('*')
    .order('ordem', { ascending: true });

  if (error) {
    console.error("Erro ao buscar status:", error);
    return [];
  }
  
  return data;
}

export async function getPostosGasolinaDataByClientId(clientId: string): Promise<PostosGasolinaDataRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_postos_gasolina_overview');

  if (error) {
    console.error(`❌ [Supabase] Erro ao buscar dados para o cliente ${clientId}:`, error);
    return [];
  }

  // Filtra os dados no lado do servidor da aplicação, já que a RPC retorna tudo
  return (data || []).filter(empresa => empresa.cliente_id === clientId);
}

export async function getClienteById(clientId: string): Promise<PostosGasolinaCliente | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('postos_gasolina_clientes')
    .select('id, nome')
    .eq('id', clientId)
    .single();

  if (error) {
    console.error(`❌ [Supabase] Erro ao buscar cliente ${clientId}:`, error);
    return null;
  }

  return data;
}

export async function getContractByClientId(clientId: string): Promise<any | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('postos_gasolina_contratos')
    .select('*')
    .eq('client_id', clientId)
    .single();

  
  if (error) {
    console.error(`❌ [Supabase] Erro ao buscar contrato para o cliente ${clientId}:`, error);
    return null;
  }

  return data;
}

export async function upsertContract(contractData: any) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('postos_gasolina_contratos')
    .upsert(contractData, { onConflict: 'client_id' })
    .select()
    .single();

  if (error) {
    console.error('❌ [Supabase] Erro ao criar/atualizar contrato:', error);
    throw error;
  }

  return data;
}
