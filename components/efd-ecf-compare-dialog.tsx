"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { PostosGasolinaDataRow } from "@/types/supabase"
import { createClient } from "@/lib/supabase/client"

type AberturaReceitaPeriodo = {
  receita_revenda?: number;
}

type EcfRow = {
  exercicio: number | null
  abertura_receita: Record<string, AberturaReceitaPeriodo> | null
}

type EfdRow = {
  ano_mes: string
  json_receita_revenda: {
    totais?: { total_geral?: number }
  } | null
}

interface EfdEcfCompareDialogProps {
  isOpen: boolean
  onClose: () => void
  empresa: PostosGasolinaDataRow | null
}

type CompareRow = {
  year: string
  ecf_revenda: number
  efd_total: number
  delta: number
  deltaPct: number | null
}

export function EfdEcfCompareDialog({ isOpen, onClose, empresa }: EfdEcfCompareDialogProps) {
  const [rows, setRows] = React.useState<CompareRow[]>([])
  const [loading, setLoading] = React.useState(false)

  const formatCurrency = (v: number | null | undefined) =>
    v == null ? "N/A" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

  const formatPercent = (v: number | null | undefined) =>
    v == null ? "N/A" : `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}%`

  React.useEffect(() => {
    const run = async () => {
      if (!isOpen || !empresa) return
      setLoading(true)
      const supabase = createClient()

      // ECF: soma anual de receita_revenda por exercício
      const { data: ecfData } = await supabase
        .from("ecf_processados")
        .select("exercicio, abertura_receita")
        .eq("empresa_id", empresa.empresa_id)
        .order("exercicio", { ascending: true }) as { data: EcfRow[] | null }

      const ecfByYear = new Map<string, number>()
      for (const ecf of ecfData || []) {
        const year = String(ecf.exercicio ?? "")
        if (!year) continue
        const abertura = ecf.abertura_receita || {}
        let sum = 0
        for (const key of Object.keys(abertura)) {
          const periodo = abertura[key] || {}
          const val = Number(periodo.receita_revenda || 0)
          if (!Number.isNaN(val)) sum += val
        }
        ecfByYear.set(year, (ecfByYear.get(year) || 0) + sum)
      }

      // EFD: soma total_geral por ano (derivado de ano_mes)
      const { data: efdData } = await supabase
        .from("efd_contribuicoes_processados")
        .select("ano_mes, json_receita_revenda")
        .eq("empresa_id", empresa.empresa_id)
        .order("ano_mes", { ascending: true }) as { data: EfdRow[] | null }

      const efdByYear = new Map<string, number>()
      for (const efd of efdData || []) {
        const yyyymm = efd.ano_mes || ""
        if (yyyymm.length < 6) continue
        const year = yyyymm.substring(0, 4)
        const total = Number(efd.json_receita_revenda?.totais?.total_geral || 0)
        if (!Number.isNaN(total)) efdByYear.set(year, (efdByYear.get(year) || 0) + total)
      }

      // Merge anos
      const years = new Set<string>([...ecfByYear.keys(), ...efdByYear.keys()])
      const out: CompareRow[] = []
      for (const y of Array.from(years).sort()) {
        const ecfVal = ecfByYear.get(y) || 0
        const efdVal = efdByYear.get(y) || 0
        const delta = efdVal - ecfVal
        const deltaPct = ecfVal !== 0 ? (delta / ecfVal) * 100 : null
        out.push({ year: y, ecf_revenda: ecfVal, efd_total: efdVal, delta, deltaPct })
      }
      setRows(out)
      setLoading(false)
    }

    run()
  }, [isOpen, empresa])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Comparativo EFD × ECF: {empresa?.nome_empresa}</DialogTitle>
          <DialogDescription>
            Soma anual da Receita de Revenda (ECF) versus total apurado nas EFDs (NF-e + Cupom estimado).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">ECF: Receita Revenda</TableHead>
                <TableHead className="text-right">EFD: Total Apurado</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">% Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Sem dados para exibir.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.year}>
                    <TableCell className="font-medium">{r.year}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.ecf_revenda)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.efd_total)}</TableCell>
                    <TableCell className={`text-right ${r.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(r.delta)}
                    </TableCell>
                    <TableCell className={`text-right ${r.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatPercent(r.deltaPct)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
