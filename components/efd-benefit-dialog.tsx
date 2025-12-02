"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { QuarterlyDetailsDialog } from "./quarterly-details-dialog"
import type { PostosGasolinaDataRow, EcfProcessedData } from "@/types/supabase"
import { getSelicRates, calculateSelic, SelicRate } from "@/lib/selic"
import { Loader2, Eye } from "lucide-react"
import { toast } from "sonner"

type EfdRow = {
  ano_mes: string
  json_receita_revenda: {
    totais?: { total_geral?: number }
  } | null
}

type TributosPeriodo = {
  base_irpj?: number
  base_csll?: number
  irpj_devido_original?: number
  csll_devida_original?: number
}
type InformacoesTributos = Record<string, TributosPeriodo>
type AberturaReceita = Record<string, { receita_revenda?: number } & Record<string, unknown>>
type CalculoBeneficio = Record<
  string,
  {
    perdaGeradaNoPeriodo?: number
    novaBaseCalculoIRPJ?: number
    novoIrpjTotal?: number
    irpjRestituir?: number
    novaBaseCalculoCSLL?: number
    novaCsllTotal?: number
    csllRestituir?: number
    totalRestituirPeriodo?: number
    saldoInicialPeriodo?: number
    saldoFinalPeriodo?: number
  }
>

type EcfRow = {
  id: number
  empresa_id: string
  exercicio: number | null
  metodo_apuracao: string | null
  tipo_tributacao: string | null
  abertura_receita: AberturaReceita | null
  informacoes_tributos: InformacoesTributos | null
  recolhimentos_efetuados: Record<string, unknown> | null
  calculo_beneficio: CalculoBeneficio | null
  storage_path?: string | null
}

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "N/A"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Mapeia mês (1-12) para trimestre "1T".."4T"
function monthToQuarterKey(m: number): string {
  if (m <= 3) return "1T"
  if (m <= 6) return "2T"
  if (m <= 9) return "3T"
  return "4T"
}

// Soma mensal (total_geral) da EFD por período, conforme método
function aggregateEfdByPeriod(
  efdMonthly: Map<string, number>,
  year: number,
  isAnual: boolean
): Record<string, number> {
  const byPeriod: Record<string, number> = {}
  if (isAnual) {
    let sum = 0
    for (let m = 1; m <= 12; m++) {
      const yyyymm = `${year}${String(m).padStart(2, "0")}`
      sum += efdMonthly.get(yyyymm) || 0
    }
    byPeriod["ANUAL"] = round2(sum)
    return byPeriod
  }
  // Trimestral
  const periods = ["1T", "2T", "3T", "4T"]
  for (let m = 1; m <= 12; m++) {
    const key = monthToQuarterKey(m)
    const yyyymm = `${year}${String(m).padStart(2, "0")}`
    byPeriod[key] = round2((byPeriod[key] || 0) + (efdMonthly.get(yyyymm) || 0))
  }
  // Garante todas as chaves
  for (const p of periods) byPeriod[p] = byPeriod[p] || 0
  return byPeriod
}

// Recalcula o benefício com base na receita de revenda da EFD (0,6%) e lógica de carry-over
function computeBenefitFromEfd(
  metodoApuracao: string | null,
  receitaEfdPorPeriodo: Record<string, number>,
  informacoesTributos: InformacoesTributos | null
) {
  const isAnual = Boolean(metodoApuracao?.includes("Anual"))
  const periodos = isAnual ? ["ANUAL"] : ["1T", "2T", "3T", "4T"]

  const calculo: CalculoBeneficio = {}
  let saldoNegativoAcumulado = 0

  for (const key of periodos) {
    const periodoOriginalTributo = (informacoesTributos || {})[key] || {}
    const baseOriginal = Number(periodoOriginalTributo.base_irpj || 0)

    const receitaRevendaEfd = Number(receitaEfdPorPeriodo[key] || 0)
    const perdaGeradaNoPeriodo = round2(receitaRevendaEfd * 0.006)

    const saldoInicialPeriodo = saldoNegativoAcumulado
    const totalDeducao = round2(saldoInicialPeriodo + perdaGeradaNoPeriodo)
    const resultadoFiscalBruto = round2(baseOriginal - totalDeducao)

    // saldo final (mesma ideia do ecf-processor)
    const proximoSaldoNegativo = resultadoFiscalBruto - Math.min(0, baseOriginal)
    saldoNegativoAcumulado = proximoSaldoNegativo < 0 ? Math.abs(proximoSaldoNegativo) : 0

    const baseParaCalculo = Math.max(0, resultadoFiscalBruto)
    const limite = isAnual ? 240000 : 60000
    const adicionalBase = Math.max(0, baseParaCalculo - limite)

    const novoIr = round2(baseParaCalculo * 0.15 + adicionalBase * 0.10)
    const novaCsll = round2(baseParaCalculo * 0.09)

    // originais capturados do ECF (via informacoes_tributos)
    const irpjDevidoOriginal = Number(periodoOriginalTributo.irpj_devido_original || 0)
    const csllDevidaOriginal = Number(periodoOriginalTributo.csll_devida_original || 0)

    const irpjRestituir = Math.max(0, round2(irpjDevidoOriginal - novoIr))
    const csllRestituir = Math.max(0, round2(csllDevidaOriginal - novaCsll))

    calculo[key] = {
      perdaGeradaNoPeriodo,
      novaBaseCalculoIRPJ: resultadoFiscalBruto,
      novoIrpjTotal: novoIr,
      irpjRestituir,
      novaBaseCalculoCSLL: resultadoFiscalBruto,
      novaCsllTotal: novaCsll,
      csllRestituir,
      totalRestituirPeriodo: round2(irpjRestituir + csllRestituir),
      saldoInicialPeriodo,
      saldoFinalPeriodo: saldoNegativoAcumulado,
    }
  }

  return { calculo }
}

interface EfdBenefitDialogProps {
  isOpen: boolean
  onClose: () => void
  empresa: PostosGasolinaDataRow | null
}

export function EfdBenefitDialog({ isOpen, onClose, empresa }: EfdBenefitDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [selicRates, setSelicRates] = React.useState<SelicRate[]>([])
const [rows, setRows] = React.useState<
    Array<{
      exercicio: number
      metodo_apuracao: string | null
      receitaEfdAnual: number
      perdasAnual: number
      totalCorrigido: number
      synthetic: EcfProcessedData
    }>
  >([])
  const [selected, setSelected] = React.useState<EcfProcessedData | null>(null)
  const [ecfByYear, setEcfByYear] = React.useState<Map<number, EcfRow>>(new Map())
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [downloads, setDownloads] = React.useState<Array<{ exercicio: number; path: string; url: string | null }>>([])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!isOpen || !empresa) return
      setIsLoading(true)
      const supabase = createClient()
      const rates = await getSelicRates()
      const ecfRes = await supabase
        .from("ecf_processados")
        .select("*")
        .eq("empresa_id", empresa.empresa_id)
        .order("exercicio", { ascending: false })
      const efdRes = await supabase
        .from("efd_contribuicoes_processados")
        .select("ano_mes, json_receita_revenda")
        .eq("empresa_id", empresa.empresa_id)

      if (cancelled) return
      setSelicRates(rates || [])

      const ecfData = (ecfRes.data || []) as EcfRow[]
      const efdData = (efdRes.data || []) as EfdRow[]

      // Index mensal EFD: "yyyymm" -> total_geral
      const efdMonthly = new Map<string, number>()
      for (const r of efdData || []) {
        const key = r.ano_mes
        if (!key || key.length < 6) continue
        const total = Number(r.json_receita_revenda?.totais?.total_geral || 0)
        efdMonthly.set(key, (efdMonthly.get(key) || 0) + total)
      }

const out: Array<{
        exercicio: number
        metodo_apuracao: string | null
        receitaEfdAnual: number
        perdasAnual: number
        totalCorrigido: number
        synthetic: EcfProcessedData
      }> = []

      for (const ecf of (ecfData || []) as EcfRow[]) {
        const year = Number(ecf.exercicio || 0)
        if (!year || !ecf.informacoes_tributos) continue

        const isAnual = Boolean(ecf.metodo_apuracao?.includes("Anual"))
        const receitaEfdPorPeriodo = aggregateEfdByPeriod(efdMonthly, year, isAnual)
        const receitaEfdAnual = round2(Object.values(receitaEfdPorPeriodo).reduce((s, v) => s + (Number(v) || 0), 0))
        const perdasAnual = round2(receitaEfdAnual * 0.006)

        // Monta abertura_receita com receita_revenda vinda da EFD, para exibição
        const periods = isAnual ? ["ANUAL"] : ["1T", "2T", "3T", "4T"]
        const abertura_receita_num: { [key: string]: number } = {}
        for (const p of periods) {
          abertura_receita_num[p] = round2(receitaEfdPorPeriodo[p] || 0)
        }

        const { calculo } = computeBenefitFromEfd(ecf.metodo_apuracao, receitaEfdPorPeriodo, ecf.informacoes_tributos || {})

        const synthetic: EcfProcessedData = {
          id: ecf.id,
          nome_arquivo: `EFD_${year}`,
          exercicio: year,
          data_inicio: null,
          data_fim: null,
          tipo_tributacao: ecf.tipo_tributacao || null,
          metodo_apuracao: ecf.metodo_apuracao || null,
          resultado_tributado: null,
          abertura_receita: abertura_receita_num,
          informacoes_tributos: ecf.informacoes_tributos || {},
          recolhimentos_efetuados: ecf.recolhimentos_efetuados || {},
          calculo_beneficio: calculo,
        }

        // Soma total corrigido c/ SELIC para exibir na linha anual
        let totalCorrigido = 0
        for (const key of Object.keys(calculo)) {
          const base = Number(calculo[key]?.totalRestituirPeriodo || 0)
          const selic = calculateSelic(base, key, year, rates || [])
          totalCorrigido += base + selic
        }

        out.push({
          exercicio: year,
          metodo_apuracao: ecf.metodo_apuracao || null,
          receitaEfdAnual,
          perdasAnual,
          totalCorrigido: round2(totalCorrigido),
          synthetic,
        })
      }

      setRows(out)

      // Indexa ECF por ano (para recuperar storage_path na geração)
      const map = new Map<number, EcfRow>()
      for (const e of ecfData || []) {
        const y = Number(e.exercicio || 0)
        if (y) map.set(y, e as EcfRow)
      }
      setEcfByYear(map)

      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isOpen, empresa])

  async function handleGenerateRetificador() {
    try {
      if (!empresa) return
      setIsGenerating(true)
      setDownloads([])
      const supabase = createClient()

      // Arquivos (somente 2020-2024, com storage_path válido)
      const arquivos = Array.from(ecfByYear.entries())
        .filter(([year, ecf]) => year >= 2020 && year <= 2024 && !!ecf.storage_path)
        .map(([year, ecf]) => ({
          exercicio: year,
          filePath: String(ecf.storage_path),
        }))

      // Ajustes por período, derivados dos cálculos já exibidos
      const ajustes: Array<{
        exercicio: number
        metodo: "ANUAL" | "TRIMESTRAL"
        periodo: "ANUAL" | "1T" | "2T" | "3T" | "4T"
        perdaGeradaNoPeriodo: number
        novaBaseIRPJ: number
        novoIRPJ15: number
        novoIRPJAdicional: number
        novaBaseCSLL: number
        novaCSLLTotal: number
      }> = []

      for (const r of rows) {
        const exercicio = r.exercicio
        if (exercicio < 2020 || exercicio > 2024) continue
        const metodo: "ANUAL" | "TRIMESTRAL" = r.metodo_apuracao?.includes("Anual") ? "ANUAL" : "TRIMESTRAL"
        const calculo = (r.synthetic?.calculo_beneficio || {}) as Record<
          string,
          {
            perdaGeradaNoPeriodo?: number
            novaBaseCalculoIRPJ?: number
            novoIrpjTotal?: number
            novaBaseCalculoCSLL?: number
            novaCsllTotal?: number
          }
        >
        const isAnual = metodo === "ANUAL"

        for (const [periodo, val] of Object.entries(calculo)) {
          const perda = Number(val?.perdaGeradaNoPeriodo || 0)
          const baseIR = Math.max(0, Number(val?.novaBaseCalculoIRPJ || 0))
          const baseCS = Math.max(0, Number(val?.novaBaseCalculoCSLL || 0))
          const limite = isAnual ? 240000 : 60000
          const adicionalBase = Math.max(0, baseIR - limite)
          const novoIR15 = round2(baseIR * 0.15)
          const novoIRAdicional = round2(adicionalBase * 0.10)
          const novaCSLLTotal = round2(Number(val?.novaCsllTotal || 0))

          ajustes.push({
            exercicio,
            metodo,
            periodo: periodo as 'ANUAL' | '1T' | '2T' | '3T' | '4T',
            perdaGeradaNoPeriodo: round2(perda),
            novaBaseIRPJ: round2(baseIR),
            novoIRPJ15: round2(novoIR15),
            novoIRPJAdicional: round2(novoIRAdicional),
            novaBaseCSLL: round2(baseCS),
            novaCSLLTotal,
          })
        }
      }

      if (arquivos.length === 0 || ajustes.length === 0) {
        toast.error("Nada a gerar", { description: "Não há arquivos elegíveis (2020–2024) ou ajustes calculados." })
        setIsGenerating(false)
        return
      }

      const payload = {
        empresaId: empresa.empresa_id,
        arquivos,
        consolidadoPorPeriodo: true,
        codAjusteIRPJ: "900",
        codAjusteCSLL: "900",
        descricaoAjuste: "Perda por Evaporação",
        ajustes,
      }

      const { data, error } = await supabase.functions.invoke("ecf-retificador", { body: payload })
      if (error) throw error
      if (data?.success) {
        const total = Array.isArray(data.arquivos) ? data.arquivos.length : 0
        toast.success("Retificadora gerada", { description: `${total} arquivo(s) gerado(s) com sucesso.` })

        // Preferência: baixar automaticamente um único ZIP com todos os TXT
        type RetificadorArquivo = { exercicio?: number; pathRetificador?: string }
        const arquivos: Array<{ exercicio: number; pathRetificador: string }> = Array.isArray(data.arquivos)
          ? (data.arquivos as RetificadorArquivo[]).map((a) => ({
              exercicio: Number(a.exercicio ?? 0),
              pathRetificador: String(a.pathRetificador ?? "")
            }))
          : []

        const paths = arquivos.map((a) => a.pathRetificador).filter(Boolean)

        const zipNameBase = `ECF_RET_${empresa?.nome_empresa || empresa?.empresa_id || "arquivos"}`
        try {
          const respZip = await fetch("/api/ecf-ret-zip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths, zipName: zipNameBase }),
          })

          if (respZip.ok) {
            const blob = await respZip.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${zipNameBase}.zip`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
          } else {
            // Fallback: dispara múltiplos downloads (signed URLs)
            const signed = await Promise.all(
              arquivos.map(async (a) => {
                try {
                  const resp = await fetch("/api/ecf-ret-download", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: a.pathRetificador, expiresIn: 3600 }),
                  })
                  const j = await resp.json().catch(() => null)
                  return { exercicio: a.exercicio, path: a.pathRetificador, url: j?.url || null }
                } catch {
                  return { exercicio: a.exercicio, path: a.pathRetificador, url: null }
                }
              })
            )

            // Dispara downloads um-a-um
            for (const s of signed) {
              if (s.url) {
                const name = s.path.split("/").pop() || "arquivo.txt"
                const link = document.createElement("a")
                link.href = s.url
                link.download = name
                document.body.appendChild(link)
                link.click()
                link.remove()
              }
            }
            setDownloads(signed)
          }
        } catch {
          // Fallback em caso de erro no ZIP
          const signed = await Promise.all(
            arquivos.map(async (a) => {
              try {
                const resp = await fetch("/api/ecf-ret-download", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ path: a.pathRetificador, expiresIn: 3600 }),
                })
                const j = await resp.json().catch(() => null)
                return { exercicio: a.exercicio, path: a.pathRetificador, url: j?.url || null }
              } catch {
                return { exercicio: a.exercicio, path: a.pathRetificador, url: null }
              }
            })
          )
          for (const s of signed) {
            if (s.url) {
              const name = s.path.split("/").pop() || "arquivo.txt"
              const link = document.createElement("a")
              link.href = s.url
              link.download = name
              document.body.appendChild(link)
              link.click()
              link.remove()
            }
          }
          setDownloads(signed)
        }
      } else {
        throw new Error(data?.error || "Falha desconhecida na geração da retificadora.")
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.error("Falha na geração da retificadora", { description: message })
    } finally {
      setIsGenerating(false)
    }
  }

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

          {isLoading ? (
            <div className="flex items-center justify-center h-56 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Calculando benefício com base na EFD...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-muted-foreground">
              Nenhum exercício encontrado para cálculo.
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Exercício</TableHead>
                      <TableHead>Apuração</TableHead>
                      <TableHead className="text-right">Receita de Revenda</TableHead>
                      <TableHead className="text-right">Perdas por Evaporação</TableHead>
                      <TableHead className="text-right font-bold text-green-600">Tributos a Restituir</TableHead>
                      <TableHead className="w-[120px] text-center">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.exercicio}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelected(r.synthetic)}
                      >
                        <TableCell className="font-medium">{r.exercicio}</TableCell>
                        <TableCell>{r.metodo_apuracao || "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.receitaEfdAnual)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.perdasAnual)}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">{formatCurrency(r.totalCorrigido)}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelected(r.synthetic) }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter className="pt-4 border-t mt-4">
                <div className="flex items-center justify-end w-full">
                  <span className="text-md font-bold mr-4">Total Geral a Restituir (Atualizado):</span>
                  <span className="text-md font-bold text-green-600">
                    {formatCurrency(rows.reduce((sum, r) => sum + (r.totalCorrigido || 0), 0))}
                  </span>
                </div>
                <div className="flex items-center justify-end w-full mt-2">
                  <Button onClick={handleGenerateRetificador} disabled={isGenerating || rows.length === 0 || !empresa}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      "Gerar ECF Retificadora"
                    )}
                  </Button>
                </div>

                {downloads.length > 0 && (
                  <div className="w-full mt-4">
                    <div className="text-sm font-medium mb-2">Arquivos gerados:</div>
                    <div className="flex flex-col gap-2">
                      {downloads.map((d) => (
                        <div key={d.path} className="flex items-center justify-between border rounded p-2">
                          <span className="truncate mr-2">ECF {d.exercicio} — {d.path}</span>
                          {d.url ? (
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline whitespace-nowrap"
                            >
                              Baixar TXT
                            </a>
                          ) : (
                            <span className="text-muted-foreground whitespace-nowrap">URL indisponível</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <QuarterlyDetailsDialog
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        ecfData={selected}
      />
    </>
  )
}
