export interface PostosGasolinaCliente {
  id: string;
  nome: string;
}

export interface Status {
  id: number;
  nome: string;
  ordem: number;
  created_at: string;
}

export interface PostosGasolinaDataRow {
  empresa_id: string;
  nome_empresa: string;
  cnpj_empresa: string;
  arquivos_processados: number;
  cliente_id: string | null;
  nome_cliente: string | null;
  status_id: number | null;
  status: { id: number; nome: string; } | null;
}


export interface MonitoringDataRow {
  cliente_id: string;
  nome_cliente: string;
  quantidade_processos: number;
  ultima_atualizacao: string | null;
}


export interface EcfProcessedData {
  id: number;
  nome_arquivo: string;
  exercicio: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  tipo_tributacao: string | null;
  metodo_apuracao: string | null;
  resultado_tributado: number | null;
  abertura_receita: { [key: string]: number } | null;
  informacoes_tributos: { [key: string]: any } | null;
  recolhimentos_efetuados: { [key: string]: any } | null;
  calculo_beneficio: { [key: string]: any } | null;
}

export interface FeeTier {
  from: number;
  to: number | null;
  percentage: number;
}

export interface PostosGasolinaContrato {
  id: string;
  client_id: string;
  contract_date: string;
  fee_structure: FeeTier[];
  created_at: string;
}