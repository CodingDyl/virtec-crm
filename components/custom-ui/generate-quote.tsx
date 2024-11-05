'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { customers, projects } from "@/constants"

interface QuoteFormData {
  clientId: string
  projectType: string
  complexity: 'Low' | 'Medium' | 'High'
  urgency: 'Standard' | 'Rush' | 'Extreme Rush'
  features: string[]
  estimatedHours: number
  hourlyRate: number
}

const COMPLEXITY_MULTIPLIERS = {
  Low: 1,
  Medium: 1.5,
  High: 2
}

const URGENCY_MULTIPLIERS = {
  Standard: 1,
  Rush: 1.2,
  'Extreme Rush': 1.4
}

export default function GenerateQuote() {
  const [formData, setFormData] = useState<QuoteFormData>({
    clientId: '',
    projectType: '',
    complexity: 'Medium',
    urgency: 'Standard',
    features: [],
    estimatedHours: 0,
    hourlyRate: 300
  })

  const calculateQuote = () => {
    const baseQuote = formData.estimatedHours * formData.hourlyRate
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[formData.complexity]
    const urgencyMultiplier = URGENCY_MULTIPLIERS[formData.urgency]
    
    return baseQuote * complexityMultiplier * urgencyMultiplier
  }

  return (
    <Card className="bg-space2 border-spaceAccent">
      <CardHeader>
        <CardTitle className="text-spaceText">Generate Quote</CardTitle>
        <CardDescription className="text-spaceAccent">
          Create a custom quote for web development services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Client</Label>
          <Select 
            onValueChange={(value) => setFormData({...formData, clientId: value})}
          >
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

        {/* Project Type */}
        <div className="space-y-2">
          <Label className="text-spaceText">Project Type</Label>
          <Select
            onValueChange={(value) => setFormData({...formData, projectType: value})}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select project type" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              {projects.map((project) => (
                <SelectItem key={project.name} value={project.name}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Complexity */}
        <div className="space-y-2">
          <Label className="text-spaceText">Complexity</Label>
          <Select
            defaultValue="Medium"
            onValueChange={(value: 'Low' | 'Medium' | 'High') => 
              setFormData({...formData, complexity: value})}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select complexity" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Urgency */}
        <div className="space-y-2">
          <Label className="text-spaceText">Urgency</Label>
          <Select
            defaultValue="Standard"
            onValueChange={(value: 'Standard' | 'Rush' | 'Extreme Rush') => 
              setFormData({...formData, urgency: value})}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select urgency" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="Standard">Standard</SelectItem>
              <SelectItem value="Rush">Rush (1 week)</SelectItem>
              <SelectItem value="Extreme Rush">Extreme Rush (2-3 days)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hours and Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-spaceText">Estimated Hours</Label>
            <Input 
              type="number"
              className="bg-space1 text-spaceText border-spaceAccent"
              value={formData.estimatedHours}
              onChange={(e) => setFormData({...formData, estimatedHours: parseInt(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-spaceText">Hourly Rate (R)</Label>
            <Input 
              type="number"
              className="bg-space1 text-spaceText border-spaceAccent"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({...formData, hourlyRate: parseInt(e.target.value)})}
            />
          </div>
        </div>

        {/* Quote Preview */}
        <div className="mt-6 p-4 bg-space1 rounded-lg">
          <h3 className="text-spaceText font-semibold mb-2">Quote Preview</h3>
          <p className="text-spaceAccent text-2xl font-bold">
            R{calculateQuote().toLocaleString()}
          </p>
        </div>

        <Button 
          className="w-full bg-spaceAccent text-space1 hover:bg-spaceAlt"
          onClick={() => {
            // TODO: Implement quote generation and saving
            console.log('Generate Quote:', formData)
          }}
        >
          Generate Quote
        </Button>
      </CardContent>
    </Card>
  )
}
