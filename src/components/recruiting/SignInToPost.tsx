'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

/** Discord sign-in that lands on the recruiting editor instead of the overview. */
export default function SignInToPost({ label = 'Sign in to post', className = 'btn btn-primary btn-sm' }: { label?: string; className?: string }) {
  const [pending, setPending] = useState(false)
  return (
    <button
      disabled={pending}
      onClick={() => { setPending(true); signIn('discord', { callbackUrl: '/dashboard/recruiting' }) }}
      className={className}
    >
      {label}
    </button>
  )
}
