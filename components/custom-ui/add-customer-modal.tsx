'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle } from "lucide-react"

export function AddCustomerModal() {
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission logic here
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-spaceAccent hover:bg-spaceAlt"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-space2 text-spaceText border-spaceAccent">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" className="bg-space1 border-spaceAccent text-spaceText" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="bg-space1 border-spaceAccent text-spaceText" />
          </div>
          <div>
            <Label htmlFor="totalSpent">Total Spent</Label>
            <Input 
              id="totalSpent" 
              type="number" 
              step="0.01"
              className="bg-space1 border-spaceAccent text-spaceText" 
            />
          </div>
          <Button type="submit" className="bg-spaceAccent hover:bg-spaceAlt text-spaceText w-full">
            Add Customer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
} 