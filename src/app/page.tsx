import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LoginPage from './(auth)/login/page'

export default async function RootPage() {
  const session = await auth()
  if (session) redirect('/dashboard')
  return <LoginPage />
}
