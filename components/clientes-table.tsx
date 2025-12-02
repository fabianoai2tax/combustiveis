"use client"

import * as React from "react"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { PostosGasolinaCliente } from "@/types/supabase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { FileUp, FilePen, Building, Pencil } from "lucide-react" // <--- Adicionei Pencil
import Link from "next/link"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

import { ContratoDialog } from "./contrato-dialog"
import { ClienteDialog } from "./cliente-dialog" // <--- Importe o novo Dialog

// Célula de Ações para a nova tabela
function ClienteActionsCell({ row }: { row: { original: PostosGasolinaCliente } }) {
  const cliente = row.original;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Estados dos Dialogs
  const [isUploading, setIsUploading] = React.useState(false);
  const [isContractOpen, setIsContractOpen] = React.useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = React.useState(false); // <--- Novo Estado para Edição

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const supabase = createClient();
    // Sanitiza o nome do arquivo
    const sanitizedFileName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `contratos/${cliente.id}/${sanitizedFileName}`;

    const { error } = await supabase.storage.from('contratos-postos').upload(filePath, file, {
      upsert: true,
    });

    if (error) {
      toast.error("Falha no Upload", { description: error.message });
    } else {
      const { error: updateError } = await supabase
        .from('postos_gasolina_clientes')
        .update({ contrato_storage_path: filePath })
        .eq('id', cliente.id);

      if (updateError) {
        toast.error("Falha ao salvar referência", { description: updateError.message });
      } else {
        toast.success("Contrato enviado com sucesso!");
      }
    }
    setIsUploading(false);
  };

  return (
    <>
      {/* Dialog de Contrato (Honorários) */}
      <ContratoDialog open={isContractOpen} onOpenChange={setIsContractOpen} cliente={cliente} />
      
      {/* Dialog de Edição do Cliente (Nome e Empresas) */}
      <ClienteDialog 
        open={isEditClientOpen} 
        onOpenChange={setIsEditClientOpen} 
        clienteToEdit={cliente} // <--- Passamos o cliente aqui para ativar o modo Edição
      />

      <div className="flex justify-end gap-2">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf,.doc,.docx" />
        
        {/* Botão Editar Cliente (Novo) */}
        <Button variant="outline" size="icon" onClick={() => setIsEditClientOpen(true)} title="Editar Cliente e Empresas">
          <Pencil className="h-4 w-4" />
        </Button>

        {/* Botão Upload Contrato PDF */}
        <Button variant="outline" size="icon" onClick={handleUploadClick} disabled={isUploading} title="Upload do Contrato (PDF)">
          <FileUp className="h-4 w-4" />
        </Button>
        
        {/* Botão Editar Honorários */}
        <Button variant="outline" size="icon" onClick={() => setIsContractOpen(true)} title="Configurar Honorários">
          <FilePen className="h-4 w-4" />
        </Button>

        {/* Botão Ver Detalhes (Empresas) */}
        <Button asChild variant="outline" size="icon" title="Ver Empresas">
          <Link href={`/clientes/${cliente.id}`}>
            <Building className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </>
  );
}

// Definição das colunas
const columns: ColumnDef<PostosGasolinaCliente>[] = [
  { accessorKey: "nome", header: "Nome do Cliente" },
  { id: "actions", header: () => <div className="text-right">Ações</div>, cell: ({ row }) => <ClienteActionsCell row={row} /> },
];

// Componente principal da tabela
export function ClientesTable({ data }: { data: PostosGasolinaCliente[] }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
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
              <TableRow key={row.id}>
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
                Nenhum cliente encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}