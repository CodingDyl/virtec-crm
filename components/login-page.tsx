'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate minimum loading time of 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Add your authentication logic here
    
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-space1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-space2 border-spaceAccent">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-spaceText text-center">Welcome Back</CardTitle>
          <CardDescription className="text-spaceAlt text-center">
            Enter your credentials to access your account
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
                className="bg-space1 text-spaceText border-spaceAccent focus:border-spaceAlt"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-spaceText">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-space1 text-spaceText border-spaceAccent focus:border-spaceAlt"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-spaceAccent hover:bg-spaceAlt text-space1 font-semibold"
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
          <div className="text-sm text-spaceAlt text-center">
            Don&apos;t have an account?{' '}
            <a href="#" className="text-spaceAccent hover:underline">
              Sign up
            </a>
          </div>
          <div className="text-sm text-spaceAlt text-center">
            <a href="#" className="text-spaceAccent hover:underline">
              Forgot your password?
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
} 