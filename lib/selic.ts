// lib/selic.ts

import { createClient } from "@/lib/supabase/client";
import { EcfProcessedData } from "@/types/supabase";

// Tipo para a taxa SELIC
export interface SelicRate {
  month: string; // Formato 'YYYY-MM-DD'
  rate: number;
}

// Função para buscar todas as taxas SELIC do Supabase
export async function getSelicRates(): Promise<SelicRate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('selic_rates')
    .select('month, rate')
    .order('month', { ascending: true });

  if (error) {
    console.error("Erro ao buscar taxas SELIC:", error);
    return [];
  }
  return data;
}

/**
 * Calcula o juro SELIC acumulado para um determinado benefício.
 * @param benefitAmount - O valor do benefício a ser corrigido.
 * @param periodKey - A chave do período ('1T', '2T', 'ANUAL', etc.).
 * @param year - O ano do exercício.
 * @param selicRates - A lista de todas as taxas SELIC.
 * @returns O valor do juro SELIC calculado.
 */
export function calculateSelic(
  benefitAmount: number,
  periodKey: string,
  year: number,
  selicRates: SelicRate[]
): number {
  if (benefitAmount <= 0 || selicRates.length === 0) {
    return 0;
  }

  // Regra: A correção começa no mês seguinte ao do vencimento do tributo.
  // Vencimento: último dia útil do mês seguinte ao do trimestre.
  // Início da correção: 1º dia do segundo mês seguinte ao do trimestre.
  let startMonth: number, startYear: number;
  
  if (periodKey.includes('1T')) { // Vence em Abril, corrige a partir de Junho
    startMonth = 6; startYear = year;
  } else if (periodKey.includes('2T')) { // Vence em Julho, corrige a partir de Setembro
    startMonth = 9; startYear = year;
  } else if (periodKey.includes('3T')) { // Vence em Outubro, corrige a partir de Dezembro
    startMonth = 12; startYear = year;
  } else if (periodKey.includes('4T') || periodKey === 'ANUAL') { // Vence em Janeiro do ano seguinte, corrige a partir de Março
    startMonth = 3; startYear = year + 1;
  } else {
    return 0; // Período inválido
  }

  const startDate = new Date(startYear, startMonth - 1, 1);
  
  // A correção vai até o mês anterior ao atual.
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  if (startDate > endDate) {
    return 0;
  }

  let totalRate = 0;

  for (const rate of selicRates) {
    const rateDate = new Date(rate.month);
    if (rateDate >= startDate && rateDate <= endDate) {
      totalRate += rate.rate;
    }
  }

  // Regra: Adiciona 1% referente ao mês do pagamento.
  totalRate += 1;

  return benefitAmount * (totalRate / 100);
}