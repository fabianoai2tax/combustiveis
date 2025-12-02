'use client'

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { CirclePlus, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { saveClienteAndEmpresas, getClienteWithEmpresas } from "@/app/actions/clientes"
import { PostosGasolinaCliente } from "@/types/supabase"

// --- Schemas ---
const empresaSchema = z.object({
  id: z.string().optional(), // ID opcional (existe apenas na edição)
  nome_empresa: z.string().min(1, "Razão Social é obrigatória"),
  cnpj_empresa: z.string().min(14, "CNPJ inválido"), // Você pode melhorar a validação de CNPJ depois
})

const clienteFormSchema = z.object({
  nome: z.string().min(3, "O nome do cliente deve ter pelo menos 3 letras"),
  empresas: z.array(empresaSchema)
})

type ClienteFormData = z.infer<typeof clienteFormSchema>

interface ClienteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteToEdit?: PostosGasolinaCliente | null // Se passar null, é modo CRIAÇÃO
}

export function ClienteDialog({ open, onOpenChange, clienteToEdit }: ClienteDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: {
      nome: "",
      empresas: [{ nome_empresa: "", cnpj_empresa: "" }] // Começa com uma linha vazia
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "empresas",
  })

  // Carregar dados se for Edição
  React.useEffect(() => {
    if (open) {
      if (clienteToEdit) {
        setIsLoading(true)
        const loadData = async () => {
          const { cliente, empresas, error } = await getClienteWithEmpresas(clienteToEdit.id)
          
          if (error) {
            toast.error("Erro ao carregar dados")
            console.error(error)
          } else {
            // LOG PARA DEBUG: Veja no Console (F12) o que está vindo do banco
            console.log("Dados vindos do banco:", empresas);

            form.reset({
              nome: cliente.nome,
              empresas: empresas && empresas.length > 0 
                ? empresas.map((e: any) => ({ 
                    id: e.id, 
                    // Tenta pegar 'nome_empresa', se não tiver, tenta 'nome', se não, vazio
                    nome_empresa: e.nome_empresa || e.nome || "", 
                    // Tenta pegar 'cnpj_empresa', se não tiver, tenta 'cnpj', se não, vazio
                    cnpj_empresa: e.cnpj_empresa || e.cnpj || "" 
                  }))
                : []
            })
          }
          setIsLoading(false)
        }
        loadData()
      } else {
        // Modo Criação: Limpa o form
        form.reset({
          nome: "",
          empresas: [{ nome_empresa: "", cnpj_empresa: "" }]
        })
      }
    }
  }, [open, clienteToEdit, form])

  const onSubmit = async (data: ClienteFormData) => {
    setIsLoading(true)
    
    const result = await saveClienteAndEmpresas({
      id: clienteToEdit?.id, // Se tiver ID, a action sabe que é update
      nome: data.nome,
      empresas: data.empresas
    })

    if (result.success) {
      toast.success(clienteToEdit ? "Cliente atualizado!" : "Cliente criado com sucesso!")
      onOpenChange(false)
    } else {
      toast.error("Erro ao salvar", { description: result.error })
    }
    
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clienteToEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do cliente e vincule as empresas (CNPJ).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Nome do Cliente */}
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente (Grupo Econômico)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Rede de Postos ABC" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lista de Empresas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Empresas Vinculadas</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => append({ nome_empresa: "", cnpj_empresa: "" })}
                >
                  <CirclePlus className="h-4 w-4 mr-2"/> 
                  Adicionar Empresa
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-3 items-start p-3 border rounded-md bg-muted/20">
                  <FormField
                    control={form.control}
                    name={`empresas.${index}.cnpj_empresa`}
                    render={({ field }) => (
                      <FormItem className="w-1/3">
                        <FormControl>
                          <Input placeholder="CNPJ" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`empresas.${index}.nome_empresa`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Razão Social" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
                  Nenhuma empresa vinculada. Clique em adicionar.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}