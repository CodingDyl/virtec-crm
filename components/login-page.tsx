'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from "lucide-react"
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '@/firebase/firebaseConfig'
import { toast } from 'sonner'
import Image from 'next/image'
import icon from '@/app/icon.png'

/** Where to land after sign-in, honouring ?next= without allowing an open redirect. */
function safeNextPath(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const next = new URLSearchParams(window.location.search).get('next')
  // Only same-site absolute paths. "//evil.com" and "https://…" are rejected.
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/dashboard'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [serverFault, setServerFault] = useState<'credentials' | 'generic' | null>(null)

  /*
   * The browser's Firebase session and the server's cookie expire on different
   * clocks. When the client is still signed in but the cookie has lapsed,
   * navigating straight to /dashboard would bounce off the middleware and come
   * back here — a redirect loop. Mint a fresh cookie first.
   *
   * Only a 403 signs the user out: that is the server saying this account is
   * genuinely not an operator. A 503 or a network failure means the *server*
   * is unwell, and signing someone out for that makes a correct password look
   * rejected — which is exactly how it reads from the sign-in form.
   */
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return

      try {
        const idToken = await user.getIdToken()
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })

        if (response.ok) {
          router.replace(safeNextPath())
        } else if (response.status === 403) {
          await signOut(auth)
          toast.error('This account is not authorised for this workspace.')
        } else {
          const { code } = await response.json().catch(() => ({ code: null }))
          setServerFault(code === 'admin-not-configured' ? 'credentials' : 'generic')
        }
      } catch (error) {
        console.error('Could not restore session:', error)
        setServerFault('generic')
      }
    })
  }, [router])

  const handleReset = async () => {
    if (!email) {
      toast.error('Enter your email address first, then tap reset.')
      return
    }

    setIsResetting(true)
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error) {
      // Deliberately not surfaced: a distinct "no such user" reply would let
      // anyone test which addresses have accounts on this workspace.
      console.error('Password reset failed:', error)
    } finally {
      setIsResetting(false)
      toast.success(`If ${email} has an account, a reset link is on its way.`)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)

      // Trade the ID token for an httpOnly session cookie so the server can
      // verify this visitor. The server rejects anyone off the allowlist, so
      // this is also where "signed in but not authorised" is caught.
      const idToken = await credential.user.getIdToken()
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        setIsLoading(false)
        const { code, error } = await response.json().catch(() => ({ code: null, error: null }))

        if (response.status === 403) {
          // Genuinely not an operator — the only case that warrants signing out.
          await signOut(auth)
          toast.error('This account is not authorised for this workspace.')
          return
        }

        // Your credentials were accepted; the server just cannot issue a
        // session. Staying signed in keeps this distinguishable from a bad
        // password, which is what it looked like before.
        setServerFault(code === 'admin-not-configured' ? 'credentials' : 'generic')
        toast.error(error ?? 'Could not start a session. Please try again.')
        return
      }

      toast.success('Successfully logged in!')
      router.replace(safeNextPath())
    } catch (error: any) {
      setIsLoading(false)
      if (error.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password')
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please try again later')
      } else {
        toast.error('An error occurred. Please try again')
      }
      console.error(error)
    }
  }

  return (
    <div className="min-h-screen bg-space1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-1">
        <CardHeader className="space-y-1">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-space1/80 border border-spaceAccent/30">
            <Image src={icon} alt="Virtara logo" width={32} height={32} />
          </div>
          <CardTitle className="virtara-display text-3xl text-spaceText text-center">Welcome Back</CardTitle>
          <CardDescription className="text-spaceAlt/90 text-center">
            Sign in to manage your projects, customers, and growth data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Your password was fine; the server could not issue a session. Said
              plainly, because the alternative reads as "wrong password". */}
          {serverFault && (
            <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              {serverFault === 'credentials' ? (
                <>
                  <p className="font-semibold">Your password is fine — the server can&apos;t sign you in.</p>
                  <p className="mt-1 text-yellow-100/85">
                    This deployment is missing its <code>FIREBASE_SERVICE_ACCOUNT</code> credential.
                    See step 3 of <code>docs/SECURITY-ROLLOUT.md</code>.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Your password is fine — the server can&apos;t start a session.</p>
                  <p className="mt-1 text-yellow-100/85">
                    Check the production function logs for <code>/api/auth/session</code>.
                  </p>
                </>
              )}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-spaceText">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-space1 text-spaceText border-spaceAccent focus:border-spaceAlt disabled:opacity-50"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-spaceText">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-space1 text-spaceText border-spaceAccent focus:border-spaceAlt disabled:opacity-50"
                required
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {/*
            No sign-up link: access is granted from the Firebase console via the
            operator allowlist, so offering to create an account would be a lie.
          */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading || isResetting}
            className="text-sm text-spaceAccent underline-offset-4 hover:underline disabled:opacity-60"
          >
            {isResetting ? 'Sending reset link…' : 'Forgot your password?'}
          </button>
        </CardFooter>
      </Card>
    </div>
  )
} 
