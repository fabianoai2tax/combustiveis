"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// Schema para validação no server-side (opcional, mas recomendado)
interface SaveClienteParams {
  id?: string // Se tiver ID é edição, se não, é criação
  nome: string
  empresas: {
    id?: string // Se tiver ID atualiza, se não cria
    nome_empresa: string
    cnpj_empresa: string
  }[]
}

export async function saveClienteAndEmpresas(data: SaveClienteParams) {
  const supabase = await createClient()

  try {
    // 1. Salvar ou Criar o Cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('postos_gasolina_clientes')
      .upsert({ 
        id: data.id, // Se for undefined, o Supabase cria um novo ID
        nome: data.nome 
      })
      .select()
      .single()

    if (clienteError) throw new Error(`Erro ao salvar cliente: ${clienteError.message}`)

    // 2. Preparar as empresas com o ID do cliente recém salvo/atualizado
    if (data.empresas.length > 0) {
      const empresasToUpsert = data.empresas.map(empresa => ({
        id: empresa.id, // Mantém o ID se for edição
        cliente_id: cliente.id, // Vincula ao cliente
        nome_empresa: empresa.nome_empresa,
        cnpj_empresa: empresa.cnpj_empresa,
        // status_id: 1 // Caso precise definir um status padrão
      }))

      const { error: empresasError } = await supabase
        .from('postos_gasolina_empresas')
        .upsert(empresasToUpsert)

      if (empresasError) throw new Error(`Erro ao salvar empresas: ${empresasError.message}`)
    }

    revalidatePath("/clientes")
    return { success: true, clienteId: cliente.id }

  } catch (error: unknown) {
    console.error("Erro na action saveClienteAndEmpresas:", error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// Busca dados completos para edição
export async function getClienteWithEmpresas(clienteId: string) {
  const supabase = await createClient()
  
  const { data: cliente, error: errCliente } = await supabase
    .from('postos_gasolina_clientes')
    .select('*')
    .eq('id', clienteId)
    .single()

  if (errCliente) return { error: errCliente.message }

  const { data: empresas, error: errEmpresas } = await supabase
    .from('postos_gasolina_empresas')
    .select('*')
    .eq('cliente_id', clienteId)

  if (errEmpresas) return { error: errEmpresas.message }

  return { cliente, empresas }
}