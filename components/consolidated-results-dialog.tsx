// components/consolidated-results-dialog.tsx

"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { PostosGasolinaCliente, EcfProcessedData } from "@/types/supabase"
import { getSelicRates, calculateSelic, SelicRate } from "@/lib/selic"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"

interface ConsolidatedResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: PostosGasolinaCliente | null;
}

interface ConsolidatedData {
  nome_empresa: string;
  cnpj_empresa: string;
  total_restituir_corrigido: number;
  perdas_nao_utilizadas: number;
}

export function ConsolidatedResultsDialog({ isOpen, onClose, cliente }: ConsolidatedResultsDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [consolidatedData, setConsolidatedData] = React.useState<ConsolidatedData[]>([]);
  const [selicRates, setSelicRates] = React.useState<SelicRate[]>([]);

  React.useEffect(() => {
    if (isOpen && cliente) {
      const fetchData = async () => {
        setIsLoading(true);
        const supabase = createClient();
        
        const [rates, { data: ecfData, error }] = await Promise.all([
          getSelicRates(),
          supabase
            .from('ecf_processados')
            .select('*, postos_gasolina_empresas(nome, cnpj, cliente_id)')
            .eq('postos_gasolina_empresas.cliente_id', cliente.id)
        ]);

        setSelicRates(rates);

        if (error) {
          console.error("Erro ao buscar dados consolidados:", error);
          setConsolidatedData([]);
          setIsLoading(false);
          return;
        }

        // Agrupa os dados por empresa
        const dataByEmpresa = ecfData.reduce((acc, ecf) => {
          
          const empresaId = ecf.empresa_id;
          const empresaRelacionada = ecf.postos_gasolina_empresas as any;

          if (empresaId && empresaRelacionada) {
            if (!acc[empresaId]) {
              acc[empresaId] = {
                nome_empresa: empresaRelacionada.nome,
                cnpj_empresa: empresaRelacionada.cnpj,
                ecfs: [],
              };
            }
            acc[empresaId].ecfs.push(ecf);
          }
          return acc;

        }, {} as any);

        const finalData = Object.values(dataByEmpresa).map((empresa: any) => {
          
          if (!empresa.ecfs || empresa.ecfs.length === 0) {
            return {
              nome_empresa: empresa.nome_empresa,
              cnpj_empresa: empresa.cnpj_empresa,
              total_restituir_corrigido: 0,
              perdas_nao_utilizadas: 0,
            };
          }
          
          const total_restituir_corrigido = empresa.ecfs.reduce((totalSum: number, ecf: EcfProcessedData) => {
            const beneficioAnualComSelic = Object.entries(ecf.calculo_beneficio || {}).reduce((sum, [key, periodo]: [string, any]) => {
              const beneficioPeriodo = periodo.totalRestituirPeriodo || 0;
              const selicPeriodo = calculateSelic(beneficioPeriodo, key, ecf.exercicio!, rates);
              return sum + beneficioPeriodo + selicPeriodo;
            }, 0);
            return totalSum + beneficioAnualComSelic;
          }, 0);

          const ultimoExercicio = empresa.ecfs.sort((a: EcfProcessedData, b: EcfProcessedData) => (b.exercicio || 0) - (a.exercicio || 0))[0];
          const perdas_nao_utilizadas = ultimoExercicio.saldo_prejuizo_final?.irpj || 0;

          return {
            nome_empresa: empresa.nome_empresa,
            cnpj_empresa: empresa.cnpj_empresa,
            total_restituir_corrigido,
            perdas_nao_utilizadas,
          };
        });

        setConsolidatedData(finalData);
        setIsLoading(false);
      };
      fetchData();
    }
  }, [isOpen, cliente]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(14);
    doc.text(`Relatório Consolidado: ${cliente?.nome || ""}`, 14, 18);

    // Cabeçalho da tabela
    const tableColumn = [
      "Empresa",
      "CNPJ",
      "Total a Recuperar (c/ SELIC)",
      "Perdas Não Utilizadas"
    ];

    // Dados da tabela
    const tableRows = consolidatedData.map((empresa) => [
      empresa.nome_empresa,
      empresa.cnpj_empresa,
      formatCurrency(empresa.total_restituir_corrigido),
      formatCurrency(empresa.perdas_nao_utilizadas)
    ]);

    // Totais
    const totalRecuperar = consolidatedData.reduce((sum, empresa) => sum + empresa.total_restituir_corrigido, 0);
    const totalPerdas = consolidatedData.reduce((sum, empresa) => sum + empresa.perdas_nao_utilizadas, 0);

    // Adiciona a tabela
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243], halign: "center" }, // cabeçalho centralizado
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" }
    }
    });

    // Adiciona os totais ao final
    const finalY = (doc as any).lastAutoTable.finalY || 28;
    doc.setFontSize(12);
    doc.text(
      `Total a Recuperar: ${formatCurrency(totalRecuperar)}`,
      14,
      finalY + 10
    );
    doc.text(
      `Total de Perdas Não Utilizadas: ${formatCurrency(totalPerdas)}`,
      14,
      finalY + 18
    );

    // Salva o PDF
    doc.save(`relatorio_consolidado_${cliente?.nome || "cliente"}.pdf`);
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Resultado Consolidado: {cliente?.nome}</DialogTitle>
          <DialogDescription>
            Visão geral dos valores a restituir e perdas não utilizadas para todas as empresas do cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="text-right">Total a Recuperar (c/ SELIC)</TableHead>
                  <TableHead className="text-right">Perdas Não Utilizadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consolidatedData.map((empresa) => (
                  <TableRow key={empresa.cnpj_empresa}>
                    <TableCell className="font-medium">{empresa.nome_empresa}</TableCell>
                    <TableCell>{empresa.cnpj_empresa}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">{formatCurrency(empresa.total_restituir_corrigido)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(empresa.perdas_nao_utilizadas)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

         {!isLoading && consolidatedData.length > 0 && (
          <DialogFooter className="pt-4 border-t mt-4">
            <div className="flex items-center justify-end w-full gap-x-6">
              {/* Total a Recuperar */}
              <div>
                <span className="text-sm font-bold mr-2 text-muted-foreground">Total a Recuperar (Corrigido):</span>
                <span className="text-sm font-bold text-green-600">
                  {formatCurrency(
                    consolidatedData.reduce((sum, empresa) => sum + empresa.total_restituir_corrigido, 0)
                  )}
                </span>
              </div>
              {/* Perdas Não Utilizadas */}
              <div>
                <span className="text-sm font-bold mr-2 text-muted-foreground">Total de Perdas Não Utilizadas:</span>
                <span className="text-sm font-bold">
                  {formatCurrency(
                    consolidatedData.reduce((sum, empresa) => sum + empresa.perdas_nao_utilizadas, 0)
                  )}
                </span>
              </div>
            </div>
            <div className="flex justify-end w-full">
              <Button
                onClick={handleExportPDF}
                disabled={isLoading}
              >
                Exportar PDF
              </Button>
            </div>
          </DialogFooter>
        )} 

      </DialogContent>
    </Dialog>
  );
}