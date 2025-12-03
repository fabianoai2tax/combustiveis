"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PostosGasolinaDataRow } from "@/types/supabase"

export interface EfdMonthlySummary {
  ano_mes: string
  total_nfe_c170: number
  total_nfe_c175: number
  total_nfe: number
  total_cupom_c481_cst04: number
  total_cupom_c405: number
  total_cupom_total: number
  total_geral: number
}

interface EfdResultsDialogProps {
  isOpen: boolean
  onClose: () => void
  empresa: PostosGasolinaDataRow | null
  results: EfdMonthlySummary[] // vindo da função (campo totais_por_mes)
}

export function EfdResultsDialog({ isOpen, onClose, empresa, results }: EfdResultsDialogProps) {
  const formatCurrency = (v: number | null | undefined) =>
    v == null ? "N/A" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)


  const totalMeses = React.useMemo(() => {
    return (results || []).reduce(
      (acc, r) => {
        acc.nfe += r.total_nfe || 0
        acc.c481 += r.total_cupom_c481_cst04 || 0
        acc.c405 += r.total_cupom_c405 || 0
        acc.cupom += r.total_cupom_total || 0
        acc.total += r.total_geral || 0
        return acc
      },
      { nfe: 0, c481: 0, c405: 0, cupom: 0, total: 0 }
    )
  }, [results])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Resultados EFD-Contribuições: {empresa?.nome_empresa}</DialogTitle>
          <DialogDescription>
            Totais por mês consolidados da última execução (NF-e, Cupom C481 CST 04, C405 e Cupom Total).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Mês</TableHead>
                <TableHead className="text-right whitespace-nowrap">NF-e Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Cupom C481 (CST 04)</TableHead>
                <TableHead className="text-right whitespace-nowrap">Cupom C405 (VL_BRT)</TableHead>
                <TableHead className="text-right whitespace-nowrap">Cupom Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total Geral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(results || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados para exibir.</TableCell>
                </TableRow>
              ) : (
                <>
                  {results
                    .slice()
                    .sort((a, b) => a.ano_mes.localeCompare(b.ano_mes))
                    .map((r) => (
                      <TableRow key={r.ano_mes}>
                        <TableCell className="font-medium">{r.ano_mes}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_nfe)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_cupom_c481_cst04)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_cupom_c405)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_cupom_total)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(r.total_geral)}</TableCell>
                      </TableRow>
                    ))}
                  <TableRow>
                    <TableCell className="font-semibold">Totais</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totalMeses.nfe)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totalMeses.c481)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totalMeses.c405)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totalMeses.cupom)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalMeses.total)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
