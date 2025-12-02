'use client'

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, CirclePlus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PostosGasolinaCliente, PostosGasolinaDataRow } from "@/types/supabase"
import { getContratoInitialData, saveContrato } from "@/app/actions/contratos"

// Schema de validação com Zod
const feeTierSchema = z.object({
  from: z.coerce.number().min(0, "Valor inicial deve ser positivo."),
  to: z.coerce.number().optional().nullable(),
  percentage: z.coerce.number().min(0, "Percentual não pode ser negativo.").max(100, "Percentual não pode ser maior que 100."),
});

const contractSchema = z.object({
  contract_date: z.date({ required_error: "A data do contrato é obrigatória." }),
  fee_structure: z.array(feeTierSchema).min(1, "Adicione pelo menos uma faixa de honorários."),
});

type ContractFormData = z.infer<typeof contractSchema>;

interface ContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: PostosGasolinaCliente | null;
}

export function ContratoDialog({ open, onOpenChange, cliente }: ContratoDialogProps) {
  const [companies, setCompanies] = React.useState<PostosGasolinaDataRow[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      fee_structure: [{ from: 0, to: null, percentage: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fee_structure",
  });

  React.useEffect(() => {
    if (open && cliente) {
      form.reset();
      setCompanies([]);
      const fetchData = async () => {
        const { contract, companies, error } = await getContratoInitialData(cliente.id);
        if (error) {
          toast.error("Erro ao carregar dados", { description: error });
          return;
        }
        if (contract && contract.contract_date) {
          // Analisa a string YYYY-MM-DD manualmente para evitar problemas de fuso horário
          const [year, month, day] = contract.contract_date.split('-').map(Number);
          // O construtor de Date usa mês 0-indexado (0 para Janeiro)
          const localDate = new Date(year, month - 1, day);

          form.reset({
            contract_date: localDate,
            fee_structure: contract.fee_structure,
          });
        }
        setCompanies(companies);
      };
      fetchData();
    }
  }, [open, cliente, form]);

  const onSubmit = async (data: ContractFormData) => {
    if (!cliente) return;
    setIsSaving(true);

    const result = await saveContrato({
      client_id: cliente.id,
      contract_date: format(data.contract_date, 'yyyy-MM-dd'),
      fee_structure: data.fee_structure,
    });

    if (result.success) {
      toast.success("Contrato salvo com sucesso!");
      onOpenChange(false);
    } else {
      toast.error("Falha ao salvar", { description: result.error });
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contrato de Honorários</DialogTitle>
          <DialogDescription>
            Gerencie as informações do contrato do cliente <strong>{cliente?.nome}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="contract_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data do Contrato</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-[240px] pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Estrutura de Honorários</FormLabel>
              <div className="space-y-2 pt-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`fee_structure.${index}.from`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input placeholder="De (R$)" {...field} value={field.value ?? ''} type="number" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`fee_structure.${index}.to`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormControl>
                            <Input placeholder="Até (R$)" {...field} value={field.value ?? ''} type="number" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`fee_structure.${index}.percentage`}
                      render={({ field }) => (
                        <FormItem className="w-28 flex-shrink-0">
                          <FormControl>
                            <Input placeholder="%" {...field} value={field.value ?? ''} type="number" className="text-right" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mt-1">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ from: 0, to: null, percentage: 0 })}><CirclePlus className="h-4 w-4 mr-2"/> Adicionar Faixa</Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Empresas Contratantes</h4>
              <div className="rounded-md border max-h-40 overflow-y-auto text-sm">
                {companies.length > 0 ? (
                  companies.map(c => <div key={c.empresa_id} className="p-2 border-b">{c.nome_empresa} - {c.cnpj_empresa}</div>)
                ) : (
                  <div className="p-4 text-center text-muted-foreground">Nenhuma empresa vinculada.</div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar Contrato"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
