"use client"

import * as React from "react"
import { EcfProcessedData } from "@/types/supabase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSelicRates, calculateSelic, SelicRate } from "@/lib/selic"
import { Loader2 } from "lucide-react"

interface RecolhimentosDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ecfData: EcfProcessedData | null;
}

interface ResultRow {
  key: string;
  beneficio: number;
  selic: number;
  total: number;
  irpjPagoEstimativa: number;
  irpjPagoDeclaracao: number;
  csllPagaEstimativa: number;
  csllPagaDeclaracao: number;
  irpjTotal: number;
  csllTotal: number;
}

export function RecolhimentosDetailsDialog({ isOpen, onClose, ecfData }: RecolhimentosDetailsDialogProps) {
  const [selicRates, setSelicRates] = React.useState<SelicRate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getSelicRates().then(rates => {
        setSelicRates(rates);
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  const summaryData = React.useMemo(() => {
    if (!ecfData || !ecfData.calculo_beneficio) return null;

    const periodos = Object.keys(ecfData.calculo_beneficio).sort();
    const results: ResultRow[] = [];
    const annualTotals = {
      beneficio: 0, selic: 0, total: 0, irpjPagoEstimativa: 0, irpjPagoDeclaracao: 0, csllPagaEstimativa: 0, csllPagaDeclaracao: 0, irpjTotal: 0, csllTotal: 0
    };

    for (const key of periodos) {
      const beneficio = ecfData.calculo_beneficio[key]?.totalRestituirPeriodo || 0;
      const selic = calculateSelic(beneficio, key, ecfData.exercicio!, selicRates);
      const total = beneficio + selic;
      
      const irpjPagoEstimativa = ecfData.recolhimentos_efetuados?.[key]?.irpj_estimativas_pagas || 0;
      const irpjPagoDeclaracao = ecfData.recolhimentos_efetuados?.[key]?.irpj_pago_declaracao || 0;
      const irpjTotal = irpjPagoEstimativa + irpjPagoDeclaracao;

      const csllPagaEstimativa = ecfData.recolhimentos_efetuados?.[key]?.csll_estimativas_pagas || 0;
      const csllPagaDeclaracao = ecfData.recolhimentos_efetuados?.[key]?.csll_paga_declaracao || 0;
      const csllTotal = csllPagaEstimativa + csllPagaDeclaracao;

      results.push({ key, beneficio, selic, total, irpjPagoEstimativa, irpjPagoDeclaracao, csllPagaEstimativa, csllPagaDeclaracao, irpjTotal, csllTotal });

      annualTotals.beneficio += beneficio;
      annualTotals.selic += selic;
      annualTotals.total += total;
      annualTotals.irpjPagoEstimativa += irpjPagoEstimativa;
      annualTotals.irpjPagoDeclaracao += irpjPagoDeclaracao;
      annualTotals.irpjTotal += irpjTotal;
      annualTotals.csllPagaEstimativa += csllPagaEstimativa;
      annualTotals.csllPagaDeclaracao += csllPagaDeclaracao;
      annualTotals.csllTotal += csllTotal;
    }
    return { periodos, results, annualTotals };
  }, [ecfData, selicRates]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  const formatPeriodLabel = (key: string) => ecfData?.metodo_apuracao?.includes('Anual') ? "Anual" : `${key.match(/\d+/)?.[0]}º Tri`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Resumo do Benefício - Exercício {ecfData?.exercicio}</DialogTitle>
          <DialogDescription>
            Demonstrativo do benefício a restituir corrigido pela SELIC e valores pagos no período.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-4">Calculando SELIC...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/5">Descrição</TableHead>
                  {summaryData?.results.map(r => <TableHead key={r.key} className="text-right">{formatPeriodLabel(r.key)}</TableHead>)}
                  <TableHead className="text-right font-bold">Total Anual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="font-bold bg-green-50 dark:bg-green-900/20">
                  <TableCell >TOTAL A RESTITUIR</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.total)}</TableCell>)}
                  <TableCell className="text-right">{formatCurrency(summaryData?.annualTotals.total || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">Principal</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.beneficio)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.beneficio || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">SELIC</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.selic)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.selic || 0)}</TableCell>
                </TableRow>

                <TableRow className="font-bold bg-muted/50 border-t mt-4">
                  <TableCell >IR PAGO NO PERÍODO</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.irpjTotal)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.irpjTotal || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">IR Estimativas</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.irpjPagoEstimativa)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.irpjPagoEstimativa || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">IR Declaração</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.irpjPagoDeclaracao)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.irpjPagoDeclaracao || 0)}</TableCell>
                </TableRow>

                <TableRow className="font-bold bg-muted/50 border-t mt-4">
                  <TableCell >CSLL PAGA NO PERÍODO</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.csllTotal)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.csllTotal || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">CSLL Estimativas</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.csllPagaEstimativa)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.csllPagaEstimativa || 0)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">CSLL Declaração</TableCell>
                  {summaryData?.results.map(r => <TableCell key={r.key} className="text-right">{formatCurrency(r.csllPagaDeclaracao)}</TableCell>)}
                  <TableCell className="text-right font-semibold">{formatCurrency(summaryData?.annualTotals.csllPagaDeclaracao || 0)}</TableCell>
                </TableRow>
                

              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}