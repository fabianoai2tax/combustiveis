"use client"

import * as React from "react"

import { Loader2 } from "lucide-react";
import { getSelicRates, calculateSelic, SelicRate } from "@/lib/selic";

import { EcfProcessedData } from "@/types/supabase"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { RevenueDetailsDialog } from "./revenue-details-dialog"
import { RecolhimentosDetailsDialog } from "./recolhimentos-details-dialog"
import { BookOpen, FileText } from "lucide-react"

interface QuarterlyDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ecfData: EcfProcessedData | null;
}

export function QuarterlyDetailsDialog({ isOpen, onClose, ecfData }: QuarterlyDetailsDialogProps) {
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = React.useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = React.useState(false);

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

  const isAnual = ecfData?.metodo_apuracao?.includes('Anual');
  const dadosReceita = ecfData?.abertura_receita || {}; 
  const dadosOriginais = ecfData?.informacoes_tributos || {}; 
  const calculos = React.useMemo(() => ecfData?.calculo_beneficio || {}, [ecfData?.calculo_beneficio]);
  const periodosKeys = React.useMemo(() => Object.keys(calculos).sort(), [calculos]);

  const summaryData = React.useMemo(() => {
    if (!ecfData || !ecfData.calculo_beneficio || selicRates.length === 0) return null;
    
    const periodData = periodosKeys.map(key => {
      const beneficioPeriodo = calculos[key]?.totalRestituirPeriodo || 0;
      const selic = calculateSelic(beneficioPeriodo, key, ecfData.exercicio!, selicRates);
      const totalCorrigido = beneficioPeriodo + selic;

      return {
        key,
        selic,
        totalCorrigido,
      };
    });

    return { periodData };

  }, [ecfData, selicRates, periodosKeys, calculos]);

  if (!ecfData) return null;

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || isNaN(value)) return "-";
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const formatPeriodLabel = (key: string) => {
    if (isAnual || key === 'ANUAL') return "Apuração Anual";
    const match = key.match(/\d+/);
    const numero = match ? match[0] : '';
    return `${numero}º Tri`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle>Apuração {isAnual ? "Anual" : "Trimestral"} - Exercício {ecfData.exercicio}</DialogTitle>
                <DialogDescription>
                  Demonstrativo de cálculo da oportunidade de restituição.
                </DialogDescription>
              </div>
            
              <div className="pt-8 pr-2">
                <Button variant="outline" size="sm" onClick={() => setIsRevenueDialogOpen(true)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Abertura da Receita
                </Button>
              </div>

          </div>
          </DialogHeader>
          <div className="mt-4 max-h-[70vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-4">Buscando taxas SELIC...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-2/5">Descrição</TableHead>
                    {periodosKeys.map((key, index) => <TableHead key={key} className="text-right">{formatPeriodLabel(key)}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* --- Bloco 1: Receita Bruta --- */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>RECEITA BRUTA</TableCell>
                    {periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(dadosReceita[key]?.receita_bruta)}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="pl-8">Receita de Revenda de Mercadorias</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(dadosReceita[key]?.receita_revenda)}</TableCell>)}</TableRow>

                  {/* --- Bloco 2: IRPJ Original --- */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>BASE DE CÁLCULO DO IRPJ</TableCell>
                    {periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(dadosOriginais[key]?.base_irpj)}</TableCell>)}</TableRow>
                  <TableRow>
                    <TableCell className="pl-8 font-semibold">IR</TableCell>
                    {periodosKeys.map(key => {
                      const baseIrpj = dadosOriginais[key]?.base_irpj || 0;
                      let irDevido = baseIrpj > 0 ? baseIrpj * 0.15 : 0;
                      
                      const limite = isAnual ? 240000 : 60000;
                      const baseAdicional = baseIrpj - limite;
                      
                      if (baseAdicional > 0) {
                        const irAdicional = baseAdicional * 0.10;
                        irDevido += irAdicional;
                      }

                      return (
                        <TableCell key={key} className="text-right font-semibold">
                          {formatCurrency(irDevido)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  
                  {/* --- Bloco 3: CSLL Original --- */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>BASE DE CÁLCULO DA CSLL</TableCell>
                    {periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(dadosOriginais[key]?.base_csll)}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="pl-8 font-semibold">CSLL</TableCell>{periodosKeys.map(key => {
                    const baseCsll = dadosOriginais[key]?.base_csll || 0;
                    const csllDevida = baseCsll * 0.09;
                  
                    return (
                      <TableCell key={key} className="text-right font-semibold">
                        {formatCurrency(csllDevida)}
                      </TableCell>
                    );
                  })}
                  </TableRow>
                    

                  {/* --- Bloco 4: Perdas Não Utilizados --- */}
                  <TableRow className="font-bold bg-red-100 dark:bg-red-900/20">
                    <TableCell colSpan={periodosKeys.length + 1}>(-) PERDAS NÃO UTILIZADAS (PERÍODOS ANTERIORES)</TableCell>
                  </TableRow>
                  <TableRow><TableCell className="pl-8">Perdas Acumuladas de Períodos Anteriores</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(calculos[key]?.saldoInicialPeriodo)}</TableCell>)}</TableRow>
                  
                  {/* --- Bloco 5: Oportunidade --- */}
                  <TableRow className="font-bold bg-blue-50 dark:bg-blue-900/20">
                    <TableCell colSpan={periodosKeys.length + 1}>(-) PERDAS POR EVAPORAÇÃO</TableCell></TableRow>
                  <TableRow><TableCell className="pl-8">Valor da Perda (0.6% da Receita de Revenda)</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right text-blue-600">{formatCurrency(calculos[key]?.perdaGeradaNoPeriodo)}</TableCell>)}</TableRow>

                  {/* --- Bloco 6: Novo IRPJ --- */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>NOVA BASE DE CÁLCULO DO IRPJ</TableCell>
                    {periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(calculos[key]?.novaBaseCalculoIRPJ)}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="pl-8 font-semibold">Novo IR a Pagar</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right font-semibold">{formatCurrency(calculos[key]?.novoIrpjTotal)}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="pl-8 font-bold text-green-600">IR A RESTITUIR</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right font-bold text-green-600">{formatCurrency(calculos[key]?.irpjRestituir)}</TableCell>)}</TableRow>

                  {/* --- Bloco 7: Nova CSLL --- */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>NOVA BASE DE CÁLCULO DA CSLL</TableCell>
                    {periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(calculos[key]?.novaBaseCalculoCSLL)}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="pl-8 font-semibold">Nova CSLL a Pagar</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right font-semibold">{formatCurrency(calculos[key]?.novaCsllTotal)}</TableCell>)}</TableRow>
                  <TableRow><TableCell className="pl-8 font-bold text-green-600">CSLL A RESTITUIR</TableCell>{periodosKeys.map(key => <TableCell key={key} className="text-right font-bold text-green-600">{formatCurrency(calculos[key]?.csllRestituir)}</TableCell>)}</TableRow>

                  {/* --- Bloco 8: SELIC --- */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>SELIC</TableCell>
                    {summaryData?.periodData.map(p => (
                      <TableCell key={p.key} className="text-right">
                        {formatCurrency(p.selic)}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* --- Bloco 9: Total --- */}
                  <TableRow className="font-bold bg-green-100 dark:bg-green-900/20">
                    <TableCell>TOTAL A RESTITUIR</TableCell>
                    {summaryData?.periodData.map(p => (
                      <TableCell key={p.key} className="text-right font-bold text-green-600">
                        {formatCurrency(p.totalCorrigido)}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* --- Bloco 9: Perdas Não Utilizadas --- */}
                  <TableRow className="font-bold bg-blue-50 dark:bg-blue-900/20">
                    <TableCell>PERDAS NÃO UTILIZADAS - ACUMULADO</TableCell>
                    {periodosKeys.map(key => <TableCell key={key} className="text-right">{formatCurrency(calculos[key]?.saldoFinalPeriodo)}</TableCell>)}</TableRow>
                
                </TableBody>
              </Table>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsSummaryDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Resumo
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <RevenueDetailsDialog
        isOpen={isRevenueDialogOpen}
        onClose={() => setIsRevenueDialogOpen(false)}
        ecfData={ecfData}
      />

      <RecolhimentosDetailsDialog
        isOpen={isSummaryDialogOpen}
        onClose={() => setIsSummaryDialogOpen(false)}
        ecfData={ecfData}
      />
      
    </>
  );
}
