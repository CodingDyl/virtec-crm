import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { customers } from '@/constants'

interface LetterAgreementData {
  clientId: string
  date: Date
  paymentMethod: string
  paymentDuration: string
  quoteId: string
  requirements: string
}

export default function LetterAgreement() {
  const [formData, setFormData] = useState<LetterAgreementData>({
    clientId: '',
    date: new Date(),
    paymentMethod: '',
    paymentDuration: '',
    quoteId: '',
    requirements: ''
  })

  const generateAgreement = () => {
    // TODO: Generate PDF or document with agreement details
    const agreement = `
      LETTER OF AGREEMENT

      Date: ${formData.date.toLocaleDateString()}

      Dear [Client Name],

      This letter confirms our agreement for web development services as detailed in Quote #${formData.quoteId}.

      Project Requirements:
      ${formData.requirements}

      Payment Terms:
      Method: ${formData.paymentMethod}
      Duration: ${formData.paymentDuration}

      [Signature blocks would go here]
    `
    console.log('Generated Agreement:', agreement)
  }

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Letter of Agreement</CardTitle>
        <CardDescription className="text-spaceAccent">
          Generate a formal agreement document for client signature
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Client</Label>
          <Select onValueChange={(value) => setFormData({...formData, clientId: value})}>
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              {customers.map((customer) => (
                <SelectItem key={customer.email} value={customer.email}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Agreement Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full bg-space1 text-spaceText border-spaceAccent justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-space1">
              <Calendar
                mode="single"
                selected={formData.date}
                onSelect={(date) => date && setFormData({...formData, date})}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <Label className="text-spaceText">Payment Method</Label>
          <Select onValueChange={(value) => setFormData({...formData, paymentMethod: value})}>
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payment Duration */}
        <div className="space-y-2">
          <Label className="text-spaceText">Payment Duration</Label>
          <Select onValueChange={(value) => setFormData({...formData, paymentDuration: value})}>
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select payment duration" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="one_time">One-time Payment</SelectItem>
              <SelectItem value="monthly">Monthly Payments</SelectItem>
              <SelectItem value="milestones">Project Milestones</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quote Link */}
        <div className="space-y-2">
          <Label className="text-spaceText">Quote Reference</Label>
          <Select onValueChange={(value) => setFormData({...formData, quoteId: value})}>
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select associated quote" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              {/* TODO: Replace with actual quotes */}
              <SelectItem value="Q001">Quote #Q001</SelectItem>
              <SelectItem value="Q002">Quote #Q002</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          <Label className="text-spaceText">Project Requirements</Label>
          <Textarea 
            className="bg-space1 text-spaceText border-spaceAccent min-h-[100px]"
            placeholder="Enter detailed project requirements..."
            value={formData.requirements}
            onChange={(e) => setFormData({...formData, requirements: e.target.value})}
          />
        </div>

        <Button 
          className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt"
          onClick={generateAgreement}
        >
          Generate Agreement
        </Button>
      </CardContent>
    </Card>
  )
}
