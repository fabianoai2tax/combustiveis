"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server" // <--- MUDANÇA: Usando server.ts em vez de admin.ts
import { PostosGasolinaDataRow, FeeTier } from "@/types/supabase";

// Retorna dados iniciais do contrato do cliente + empresas associadas
export async function getContratoInitialData(clienteId: string) {
  try {
    // 1. Cria o cliente com a sessão do usuário
    const supabase = await createClient()

    const { data: contract, error: contractError } = await supabase
      .from("postos_gasolina_contratos")
      .select("*")
      .eq("client_id", clienteId)
      .single()

    // Ignora erro se não encontrar contrato (é um novo)
    if (contractError && contractError.code !== "PGRST116") {
      console.error("Error fetching contract:", contractError)
      return { error: "Erro ao buscar contrato." }
    }

    // Usa a visão consolidada e filtra por cliente
    const { data: overview, error: companiesError } = await supabase.rpc(
      "get_postos_gasolina_overview"
    )

    if (companiesError) {
      console.error("Error fetching companies overview:", companiesError)
      return { error: "Erro ao buscar postos de gasolina associados." }
    }

    const companies = (overview || []).filter((row: PostosGasolinaDataRow) => row.cliente_id === clienteId)
    return { contract, companies }
  } catch (error: unknown) {
    console.error("Unexpected error in getContratoInitialData:", error)
    return { error: `Um erro inesperado ocorreu: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// Cria/atualiza contrato do cliente e revalida a página
export async function saveContrato(data: {
  client_id: string
  contract_date: string
  fee_structure: FeeTier[]
}) {
  try {
    // 1. Cria o cliente com a sessão do usuário
    const supabase = await createClient()
    
    const { client_id, contract_date, fee_structure } = data
    
    const { error } = await supabase
      .from("postos_gasolina_contratos")
      .upsert(
        { client_id, contract_date, fee_structure },
        { onConflict: "client_id" }
      )

    if (error) {
      console.error("Error saving contract:", error)
      return { success: false, error: "Erro ao salvar o contrato." }
    }

    // 2. MUDANÇA: Atualizei o caminho para o que você está usando agora (/clientes)
    // Se a sua página de lista for /clientes, mantenha assim. 
    // Se for /admin/postos-gasolina, altere de volta.
    revalidatePath("/clientes") 
    
    return { success: true }
  } catch (error: unknown) {
    console.error("Unexpected error in saveContrato:", error)
    return { success: false, error: `Um erro inesperado ocorreu: ${error instanceof Error ? error.message : String(error)}` }
  }
}