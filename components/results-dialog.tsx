"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { EcfProcessedData, PostosGasolinaDataRow } from "@/types/supabase"
import { Loader2, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { QuarterlyDetailsDialog } from "./quarterly-details-dialog"
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getSelicRates, calculateSelic, SelicRate } from "@/lib/selic";

interface ResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: PostosGasolinaDataRow | null;
}

export function ResultsDialog({ isOpen, onClose, empresa }: ResultsDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [ecfData, setEcfData] = React.useState<EcfProcessedData[]>([]);
  const [selectedEcf, setSelectedEcf] = React.useState<EcfProcessedData | null>(null);
  const [selicRates, setSelicRates] = React.useState<SelicRate[]>([]);
  
  const getReceitaRevendaAnual = (ecf: EcfProcessedData) => {
  if (!ecf.abertura_receita) return 0;
  return Object.values(ecf.abertura_receita).reduce((sum, periodo: any) => sum + (periodo.receita_revenda || 0), 0);
  };

  React.useEffect(() => {
    if (isOpen && empresa) {
      getSelicRates().then(setSelicRates);

      const fetchEcfData = async () => {
        setIsLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("ecf_processados")
          .select("*")
          .eq("empresa_id", empresa.empresa_id)
          .order("exercicio", { ascending: false });

        if (error) {
          console.error("Erro ao buscar dados de ECF:", error);
        } else {
          const mergedData = data.map(ecf => {
          const abertura_receita = ecf.abertura_receita || {};
          const informacoes_tributos = ecf.informacoes_tributos || {};
          const periodos = Object.keys(abertura_receita);
          for (const periodo of periodos) {
            if (informacoes_tributos[periodo]) {
              abertura_receita[periodo] = {
                ...abertura_receita[periodo],
                ...informacoes_tributos[periodo]
              };
            }
          }
            return { ...ecf, abertura_receita };
          });
          setEcfData(mergedData as EcfProcessedData[]);
        }
        setIsLoading(false);
      };
      fetchEcfData();
    }
  }, [isOpen, empresa]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "N/A";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Resultados Processados: {empresa?.nome_empresa}</DialogTitle>
            <DialogDescription>
              Visão geral anual. Clique em um ano para ver os detalhes da apuração.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : ecfData.length === 0 ? (
              <div className="flex justify-center items-center h-48"><p className="text-muted-foreground">Nenhum arquivo ECF processado encontrado.</p></div>
            ) : (
              <div className="rounded-md border">
                <TooltipProvider>  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Exercício</TableHead>
                        <TableHead>Apuração</TableHead>
                        <TableHead className="text-right">Receita de Revenda</TableHead>
                        <TableHead className="w-4 p-0"></TableHead>
                        <TableHead className="text-right">Perdas por Evaporação</TableHead>
                        <TableHead className="text-right font-bold text-green-600">Tributos a Restituir</TableHead>
                        <TableHead className="w-[80px] text-center">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ecfData.map((ecf) => {
                        const receitaRevenda = getReceitaRevendaAnual(ecf);
                        const receitaBrutaTotal = Object.values(ecf.abertura_receita || {}).reduce((sum, p: any) => sum + (p.receita_bruta || 0), 0);
                        const isFallback = receitaRevenda === 0 && receitaBrutaTotal > 0;
                        const perdas = Object.values(ecf.calculo_beneficio || {}).reduce((sum, p: any) => sum + (p.perdaGeradaNoPeriodo || 0), 0);
                        const beneficioTotalComSelic = Object.entries(ecf.calculo_beneficio || {}).reduce((sum, [key, periodo]: [string, any]) => {
                          const beneficioPeriodo = periodo.totalRestituirPeriodo || 0;
                          const selicPeriodo = calculateSelic(beneficioPeriodo, key, ecf.exercicio!, selicRates);
                          return sum + beneficioPeriodo + selicPeriodo;
                        }, 0);
                        
                        return (
                          <TableRow key={ecf.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEcf(ecf)}>
                            <TableCell className="font-medium">{ecf.exercicio}</TableCell>
                            <TableCell>{ecf.metodo_apuracao || ecf.tipo_tributacao}</TableCell>
                            <TableCell className="text-right">{formatCurrency(receitaRevenda)}</TableCell>
                            <TableCell className="p-1 align-middle text-center">
                              {isFallback && (
                                <Tooltip>
                                  <TooltipTrigger><AlertTriangle className="h-4 w-4 text-amber-500" /></TooltipTrigger>
                                  <TooltipContent>Cálculo baseado na Receita Bruta.</TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(perdas)}</TableCell>
                            <TableCell className="text-right font-bold text-green-600">{formatCurrency(beneficioTotalComSelic)}</TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </div>
            )}
          </div>
          
          <DialogFooter className="pt-4 border-t mt-4">
            <div className="flex items-center justify-end w-full">
              <span className="text-md font-bold mr-4">Total Geral a Restituir (Atualizado):</span>
              <span className="text-md font-bold text-green-600">
                {formatCurrency(
                  ecfData.reduce((totalSum, ecf) => {
                    const beneficioAnualComSelic = Object.entries(ecf.calculo_beneficio || {}).reduce((sum, [key, periodo]: [string, any]) => {
                      const beneficioPeriodo = periodo.totalRestituirPeriodo || 0;
                      const selicPeriodo = calculateSelic(beneficioPeriodo, key, ecf.exercicio!, selicRates);
                      return sum + beneficioPeriodo + selicPeriodo;
                    }, 0);
                    return totalSum + beneficioAnualComSelic;
                  }, 0)
                )}
              </span>
            </div>
          </DialogFooter>

        </DialogContent>

      </Dialog>

      <QuarterlyDetailsDialog
        isOpen={!!selectedEcf}
        onClose={() => setSelectedEcf(null)}
        ecfData={selectedEcf}
      />

    </>
  );
}