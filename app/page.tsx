import { redirect } from 'next/navigation'

export default function Home() {
  // Redireciona o usuário imediatamente para a rota /login
  redirect('/login')
}