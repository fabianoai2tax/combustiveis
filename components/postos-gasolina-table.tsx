"use client"

import * as React from "react"
import { ColumnDef, ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table"
import { Upload, FileText, ChevronLeft, ChevronRight, Loader2, FilePieChart, BarChart3, Droplets } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { PostosGasolinaDataRow, Status, PostosGasolinaCliente } from "@/types/supabase"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResultsDialog } from "./results-dialog"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConsolidatedResultsDialog } from "./consolidated-results-dialog"
import { EfdResultsDialog, EfdMonthlySummary } from "./efd-results-dialog"
import { EfdEcfCompareDialog } from "./efd-ecf-compare-dialog"
import { EfdBenefitDialog } from "./efd-benefit-dialog"

function ActionsCell({ row }: { row: { original: PostosGasolinaDataRow } }) {
  // ECF upload state/refs
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // EFD-Contribuições upload state/refs
  const [isEfdUploading, setIsEfdUploading] = React.useState(false);
  const efdFileInputRef = React.useRef<HTMLInputElement>(null);

  // Progresso de validação EFD (barra)
  const [efdProgressDone, setEfdProgressDone] = React.useState(0);
  const [efdProgressTotal, setEfdProgressTotal] = React.useState(0);

  // Dialogs
  const [isEfdDialogOpen, setIsEfdDialogOpen] = React.useState(false);
  const [efdResults, setEfdResults] = React.useState<EfdMonthlySummary[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isCompareOpen, setIsCompareOpen] = React.useState(false);
  const [isBenefitOpen, setIsBenefitOpen] = React.useState(false);
  const empresa = row.original;

  // ECF upload handlers (original)
  const handleUploadClick = () => { fileInputRef.current?.click(); };
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const supabase = createClient();
    const uploadedFilePaths: string[] = [];

    try {
      toast.info(`Iniciando upload de ${files.length} arquivo(s) ECF...`);
      const uploadPromises = Array.from(files).map(file => {
        const filePath = `uploads/${empresa.empresa_id}/${Date.now()}-${file.name}`;
        return supabase.storage.from('ecf-uploads').upload(filePath, file).then(({ error }) => {
          if (error) throw new Error(`Falha no upload do arquivo ${file.name}: ${error.message}`);
          uploadedFilePaths.push(filePath);
        });
      });

      await Promise.all(uploadPromises);
      toast.success("Upload concluído. Iniciando processamento em lotes...");

      const BATCH_SIZE = 5; // Processa 5 arquivos por vez
      let allSuccess = true;
      let finalMessage = "";

      for (let i = 0; i < uploadedFilePaths.length; i += BATCH_SIZE) {
        const chunk = uploadedFilePaths.slice(i, i + BATCH_SIZE);
        toast.info(`Processando lote ${i / BATCH_SIZE + 1}...`);
        
        const { data, error: functionError } = await supabase.functions.invoke('ecf-processor', {
          body: { empresaId: empresa.empresa_id, filePaths: chunk },
        });

        if (functionError) {
          throw functionError; // Lança o erro para ser pego pelo catch
        }

        if (data.success) {
          toast.success(`Lote ${i / BATCH_SIZE + 1} concluído: ${data.message}`);
        } else {
          allSuccess = false;
          finalMessage = data.error; // Salva a última mensagem de erro
          toast.error(`Falha no lote ${i / BATCH_SIZE + 1}`, { description: data.error });
        }
      }

      if (allSuccess) {
        toast.success("Processamento em Lote Concluído", { description: "Todos os arquivos foram processados." });
        window.location.reload();
      } else {
        throw new Error(finalMessage || "Um ou mais lotes falharam.");
      }

    } catch (e) {
      toast.error("Falha no Processamento", { description: (e as Error).message });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // EFD-Contribuições upload handlers (novo)
  const handleEfdUploadClick = () => { efdFileInputRef.current?.click(); };
  const handleEfdFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsEfdUploading(true);
    const supabase = createClient();
    const uploadedFilePaths: string[] = [];

    try {
      toast.info(`Iniciando upload de ${files.length} arquivo(s) EFD-Contribuições...`);
      const uploadPromises = Array.from(files).map(file => {
        const filePath = `uploads/${empresa.empresa_id}/${Date.now()}-${file.name}`;
        return supabase.storage.from('efd-uploads').upload(filePath, file).then(({ error }) => {
          if (error) throw new Error(`Falha no upload do arquivo ${file.name}: ${error.message}`);
          uploadedFilePaths.push(filePath);
        });
      });

      await Promise.all(uploadPromises);
      toast.success("Upload de EFD-Contribuições concluído. Validando arquivos...");

      // Processamento em lotes para evitar exceder tempo de CPU da Edge Function
      const BATCH_SIZE = Number(process.env.NEXT_PUBLIC_EFD_BATCH_SIZE ?? "5") || 5;
      const total = uploadedFilePaths.length;
      setEfdProgressDone(0);
      setEfdProgressTotal(total);
      let okCount = 0;
      let failCount = 0;
      const failedPaths: string[] = [];

      // Mapa de totais por mês consolidado (último valor por ano_mes prevalece)
      const monthMap = new Map<string, EfdMonthlySummary>();
      const allFileResults: unknown[] = [];

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = uploadedFilePaths.slice(i, i + BATCH_SIZE);

        const { data, error: functionError } = await supabase.functions.invoke('efd-contribuicoes-processor', {
          body: { empresaId: empresa.empresa_id, filePaths: chunk },
        });
        if (functionError) throw functionError;
        if (!data?.success) {
          throw new Error(data?.error || "Erro desconhecido na validação EFD");
        }

        okCount += Number(data?.summary?.success || 0);
        failCount += Number(data?.summary?.failed || 0);

        for (const m of (data?.totais_por_mes || []) as EfdMonthlySummary[]) {
          monthMap.set(m.ano_mes, m);
        }
        if (Array.isArray(data?.results)) {
          allFileResults.push(...data.results);
          const newlyFailed = (data.results as Array<{ filePath?: string; success?: boolean }>)
            .filter((r) => r?.success === false && r?.filePath)
            .map((r) => String(r.filePath));
          if (newlyFailed.length) failedPaths.push(...newlyFailed);
        }

        setEfdProgressDone((d) => d + chunk.length);
        toast.info(`Progresso: ${Math.min(i + BATCH_SIZE, total)} / ${total}`);
      }

      // Retry automático para arquivos que falharam
      if (failedPaths.length > 0) {
        // Ajusta o total esperado para incluir os retries
        setEfdProgressTotal(total + failedPaths.length);
        const RETRY_BATCH_SIZE = Math.max(1, Math.min(2, BATCH_SIZE));
        for (let j = 0; j < failedPaths.length; j += RETRY_BATCH_SIZE) {
          const retryChunk = failedPaths.slice(j, j + RETRY_BATCH_SIZE);
          const { data: rdata, error: rerr } = await supabase.functions.invoke('efd-contribuicoes-processor', {
            body: { empresaId: empresa.empresa_id, filePaths: retryChunk },
          });
          if (rerr) throw rerr;
          if (!rdata?.success) {
            throw new Error(rdata?.error || "Erro desconhecido na validação EFD (retry)");
          }
          const okThis = Number(rdata?.summary?.success || 0);
          okCount += okThis;
          failCount = Math.max(0, failCount - okThis);

          for (const m of (rdata?.totais_por_mes || []) as EfdMonthlySummary[]) {
            monthMap.set(m.ano_mes, m);
          }
          if (Array.isArray(rdata?.results)) {
            allFileResults.push(...rdata.results);
          }

          setEfdProgressDone((d) => d + retryChunk.length);
          toast.info(`Retry: ${Math.min(j + RETRY_BATCH_SIZE, failedPaths.length)} / ${failedPaths.length}`);
        }
      }

      const merged = Array.from(monthMap.values());
      setEfdResults(merged);
      setIsEfdDialogOpen(true);
      console.table(allFileResults);

      toast.success("Validação EFD-Contribuições concluída", {
        description: `Arquivos OK: ${okCount} / Falhas: ${failCount}`
      });

    } catch (e) {
      toast.error("Falha no upload/validação de EFD-Contribuições", { description: (e as Error).message });
    } finally {
      setIsEfdUploading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <div className="flex justify-end gap-2">
        {/* ECF Upload */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".txt" multiple />
        <Button
          variant="outline"
          size="icon"
          onClick={handleUploadClick}
          disabled={isUploading}
          title="Upload ECF (.txt)"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        {/* EFD-Contribuições Upload */}
        <input type="file" ref={efdFileInputRef} onChange={handleEfdFileChange} className="hidden" accept=".txt" multiple />
        <Button
          variant="outline"
          size="icon"
          onClick={handleEfdUploadClick}
          disabled={isEfdUploading}
          title="Upload EFD-Contribuições (.txt)"
        >
          {isEfdUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-blue-600" />}
        </Button>
        {/* Resultados */}
        <Button variant="outline" size="icon" onClick={() => setIsDialogOpen(true)}>
          <FileText className="h-4 w-4" />
        </Button>
        {/* Comparativo EFD × ECF */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsCompareOpen(true)}
          title="Comparar EFD × ECF"
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
        {/* Benefício (EFD) */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsBenefitOpen(true)}
          title="Calcular Benefício (EFD)"
        >
          <Droplets className="h-4 w-4" />
        </Button>
      </div>
      {/* Barra de Progresso da Validação EFD */}
      {isEfdUploading && efdProgressTotal > 0 && (
        <div className="w-full my-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Validando EFD-Contribuições</span>
            <span>
              {efdProgressDone}/{efdProgressTotal} (
              {Math.round((efdProgressDone / efdProgressTotal) * 100)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded">
            <div
              className="h-2 bg-blue-600 rounded"
              style={{ width: `${Math.round((efdProgressDone / efdProgressTotal) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <ResultsDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} empresa={empresa} />
      <EfdResultsDialog
        isOpen={isEfdDialogOpen}
        onClose={() => setIsEfdDialogOpen(false)}
        empresa={empresa}
        results={efdResults}
      />
      <EfdEcfCompareDialog
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        empresa={empresa}
      />
      <EfdBenefitDialog
        isOpen={isBenefitOpen}
        onClose={() => setIsBenefitOpen(false)}
        empresa={empresa}
      />
    </>
  );
}

function StatusCell({ row, statusOptions }: { row: { original: PostosGasolinaDataRow }, statusOptions: Status[] }) {
  const empresa = row.original;
  const [currentStatusId, setCurrentStatusId] = React.useState(empresa.status?.id?.toString() || "");
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    setCurrentStatusId(empresa.status?.id?.toString() || "");
  }, [empresa.status?.id]);

   const handleStatusChange = async (newStatusId: string) => {
    if (!newStatusId || newStatusId === currentStatusId) return;

    setIsUpdating(true);
    const supabase = createClient();
    
    const promise = (async () => {
      const { error } = await supabase
        .from('postos_gasolina_empresas')
        .update({ status_id: parseInt(newStatusId, 10) })
        .eq('id', empresa.empresa_id);
      if (error) throw error;
      return "Status atualizado com sucesso!";
    })();

    toast.promise(promise, {
      loading: `Atualizando status de ${empresa.nome_empresa}...`,
      success: (msg) => {
        setCurrentStatusId(newStatusId);
        return msg;
      },
      error: (err: unknown) => `Falha ao atualizar: ${err instanceof Error ? err.message : String(err)}`,
      finally: () => setIsUpdating(false),
    });
  };

  return (
    <Select
      value={currentStatusId}
      onValueChange={handleStatusChange}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-[200px]">
        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        <SelectValue placeholder="Selecione um status" />
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((status) => (
          <SelectItem key={status.id} value={status.id.toString()}>
            {status.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const columns: ColumnDef<PostosGasolinaDataRow>[] = [
  { accessorKey: "nome_empresa", header: "Empresa" },
  { accessorKey: "cnpj_empresa", header: "CNPJ" },
  { accessorKey: "status", header: "Status",
    cell: ({ row, table }) => {
      const statusOptions = ((table.options.meta as { statusOptions?: Status[] })?.statusOptions) || [];
      return <StatusCell row={row} statusOptions={statusOptions} />;
    },
  },

  { header: () => <div className="text-center">Arquivos Processados</div>, accessorKey: "arquivos_processados", cell: ({ row }) => <div className="text-center">{row.original.arquivos_processados}</div> },
  { id: "actions", header: () => <div className="text-right">Ações</div>, cell: ({ row }) => <ActionsCell row={row} /> },
];

interface PostosGasolinaTableProps {
  data: PostosGasolinaDataRow[];
  statusOptions: Status[];
  cliente: PostosGasolinaCliente | null;
}

export function PostosGasolinaTable({ data, statusOptions, cliente }: PostosGasolinaTableProps) {
  const [isConsolidatedOpen, setIsConsolidatedOpen] = React.useState(false);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]); // Adicionado

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters, // Adicionado para consistência
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // Adicionado para consistência
    getPaginationRowModel: getPaginationRowModel(),
    meta: { statusOptions: statusOptions },
  });

  // A variável `selectedClient` foi removida. Usamos `cliente` diretamente.

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {cliente && (
          <Button onClick={() => setIsConsolidatedOpen(true)}>
            <FilePieChart className="h-4 w-4 mr-2" />
            Ver Resultado Consolidado
          </Button>
        )}
      </div>
      
      {/* --- BLOCO DA TABELA REINTRODUZIDO --- */}
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {/* --- FIM DO BLOCO DA TABELA --- */}

      {/* --- BLOCO DE PAGINAÇÃO REINTRODUZIDO --- */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Próxima
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      {/* --- FIM DO BLOCO DE PAGINAÇÃO --- */}
      
      <ConsolidatedResultsDialog
        isOpen={isConsolidatedOpen}
        onClose={() => setIsConsolidatedOpen(false)}
        cliente={cliente} // Usa a prop `cliente` diretamente
      />
    </div>
  );
}
