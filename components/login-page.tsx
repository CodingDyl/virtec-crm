'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from "lucide-react"
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/firebase/firebaseConfig'
import { toast } from 'sonner'
import Image from 'next/image'
import icon from '@/app/icon.png'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // A live session should not have to be re-entered; the guard on /dashboard
  // sends anyone unauthorised straight back here.
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/dashboard')
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
      await signInWithEmailAndPassword(auth, email, password)
      toast.success('Successfully logged in!')
      router.push('/dashboard')
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
