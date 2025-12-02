'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ClienteDialog } from "@/components/cliente-dialog"

export function ClientesHeaderActions() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Novo
      </Button>

      <ClienteDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        clienteToEdit={null} // Null indica criação
      />
    </>
  )
}