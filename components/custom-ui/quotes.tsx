'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function Quotes() {
  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Quotes</CardTitle>
        <CardDescription className="text-spaceAccent">
          View and manage all quotes
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Add your quotes table or list here */}
      </CardContent>
    </Card>
  )
} 