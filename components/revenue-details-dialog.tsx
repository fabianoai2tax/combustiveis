"use client"

import * as React from "react"
import { EcfProcessedData } from "@/types/supabase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface RevenueDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ecfData: EcfProcessedData | null;
}

const revenueLabels: { [key: string]: string } = {
  receita_bruta: "Receita Bruta Total (Conta 3.01.01.01.01)",
  receita_revenda: "Receita de Revenda de Mercadorias",
  receita_venda_producao_propria: "Receita de Venda de Produção Própria",
  receita_prestacao_servicos: "Receita de Prestação de Serviços",
  receita_exportacao_direta: "Receita de Exportação Direta",
  receita_venda_comercial_exportadora: "Receita de Venda para Comercial Exportadora",
  receita_exportacao_servicos: "Receita de Exportação de Serviços",
  receita_venda_unidades_imobiliarias: "Receita da Venda de Unidades Imobiliárias",
  receita_locacao_bens: "Receita da Locação de Bens",
  receita_contrato_construcao: "Receita de Contrato de Construção",
  receita_direito_exploracao_servico_publico: "Receita de Direito de Exploração de Serviço Público",
  receita_securitizacao_creditos: "Receita de Securitização de Créditos",
  outras_receitas_atividade_geral: "Outras Receitas da Atividade Geral",
};

const displayOrder = [
  'receita_bruta',
  'receita_revenda',
  'receita_venda_producao_propria',
  'receita_prestacao_servicos',
  'receita_exportacao_direta',
  'receita_venda_comercial_exportadora',
  'receita_exportacao_servicos',
  'receita_venda_unidades_imobiliarias',
  'receita_locacao_bens',
  'receita_contrato_construcao',
  'receita_direito_exploracao_servico_publico',
  'receita_securitizacao_creditos',
  'outras_receitas_atividade_geral',
];

export function RevenueDetailsDialog({ isOpen, onClose, ecfData }: RevenueDetailsDialogProps) {
  if (!ecfData) return null;

  const isAnual = ecfData.metodo_apuracao?.includes('Anual');
  const periodosKeys = Object.keys(ecfData.abertura_receita || {}).filter(
    key => ecfData.abertura_receita && ecfData.abertura_receita[key] && Object.keys(ecfData.abertura_receita[key]).length > 0
  ).sort();
    
  const data = ecfData.abertura_receita || {};

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return "-";
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const formatPeriodLabel = (key: string, index: number) => {
    return isAnual ? "Apuração Anual" : `${index + 1}º Tri`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Abertura da Receita - Exercício {ecfData.exercicio}</DialogTitle>
          <DialogDescription>
            Detalhamento das contas de receita informadas na ECF.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-2/5">Descrição da Receita</TableHead>
                {periodosKeys.map((key, index) => <TableHead key={key} className="text-right">{formatPeriodLabel(key, index)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayOrder.map(revenueKey => {
                return (
                  <TableRow key={revenueKey} className={revenueKey === 'receita_bruta' ? 'font-bold bg-muted/50' : ''}>
                    <TableCell className="pl-4">{revenueLabels[revenueKey] || revenueKey}</TableCell>
                    {periodosKeys.map(pKey => (
                      <TableCell key={pKey} className="text-right">
                        {typeof data[pKey] === 'object' && data[pKey] !== null
                          ? formatCurrency(data[pKey][revenueKey])
                          : formatCurrency(data[pKey])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}