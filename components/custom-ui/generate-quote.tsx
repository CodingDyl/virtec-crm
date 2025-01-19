'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { Project } from '@/types/project'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GenerateQuoteButton } from './generate-quote-button'
import { features } from '@/constants'
import { Checkbox } from "@/components/ui/checkbox"

interface QuoteFormData {
  projectId: string
  projectType: string
  complexity: 'Low' | 'Medium' | 'High'
  urgency: 'Standard' | 'Rush' | 'Extreme Rush'
  features: string[]
  estimatedHours: number
  hourlyRate: number
  hostingCost: number
  maintenanceCost: number
  company: string
  documentType: 'Quote' | 'Invoice'
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
  const [projects, setProjects] = useState<Project[]>([])
  const [formData, setFormData] = useState<QuoteFormData>({
    projectId: '',
    projectType: '',
    complexity: 'Medium',
    urgency: 'Standard',
    features: [],
    estimatedHours: 0,
    hourlyRate: 300,
    hostingCost: 0,
    maintenanceCost: 0,
    company: '',
    documentType: 'Quote'
  })

  const [showHosting, setShowHosting] = useState(false)
  const [showMaintenance, setShowMaintenance] = useState(false)

  const fetchProjects = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "projects"))
      const projectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[]
      setProjects(projectsData)
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const calculateQuote = () => {
    const baseQuote = formData.estimatedHours * formData.hourlyRate
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[formData.complexity]
    const urgencyMultiplier = URGENCY_MULTIPLIERS[formData.urgency]
    
    return (baseQuote * complexityMultiplier * urgencyMultiplier) + 
           formData.hostingCost + 
           formData.maintenanceCost
  }

  const resetForm = () => {
    setFormData({
      projectId: '',
      projectType: '',
      complexity: 'Medium',
      urgency: 'Standard',
      features: [],
      estimatedHours: 0,
      hourlyRate: 300,
      hostingCost: 0,
      maintenanceCost: 0,
      company: '',
      documentType: 'Quote'
    })
    setShowHosting(false)
    setShowMaintenance(false)
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
        {/* Add Document Type Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Document Type</Label>
          <Select
            defaultValue="Quote"
            onValueChange={(value: 'Quote' | 'Invoice') => 
              setFormData({...formData, documentType: value})}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="Quote">Quote</SelectItem>
              <SelectItem value="Invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Company Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Company</Label>
          <Select
            onValueChange={(value) => setFormData({...formData, company: value})}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              <SelectItem value="Virtara">Virtara</SelectItem>
              <SelectItem value="Three Sixty Development">Three Sixty Development</SelectItem>
              <SelectItem value="Dylan Petzer">Dylan Petzer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Project Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Project</Label>
          <Select 
            onValueChange={(value) => {
              const selectedProject = projects.find(p => p.id === value);
              setFormData({
                ...formData, 
                projectId: value,
                projectType: selectedProject?.projectType || ''
              });
            }}
          >
            <SelectTrigger className="bg-space1 text-spaceText border-spaceAccent">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent className="bg-space1 text-spaceText">
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectType} - {project.clientName}
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

        {/* Features Selection */}
        <div className="space-y-2">
          <Label className="text-spaceText">Features Required</Label>
          <div className="grid grid-cols-2 gap-4 p-4 bg-space1 rounded-lg">
            {features.map((feature) => (
              <div key={feature.name} className="flex items-center space-x-2">
                <Checkbox
                  checked={formData.features.includes(feature.name)}
                  onCheckedChange={(checked) => {
                    const newFeatures = checked
                      ? [...formData.features, feature.name]
                      : formData.features.filter(f => f !== feature.name)
                    
                    setFormData({ ...formData, features: newFeatures })
                    setShowHosting(newFeatures.some(f => 
                      ['Dedicated Hosting', 'Cloud Hosting', 'Shared Hosting'].includes(f)))
                    setShowMaintenance(newFeatures.includes('Maintenance'))
                  }}
                />
                <Label className="text-spaceText">{feature.name}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Conditional Hosting Section */}
        {showHosting && (
          <div className="space-y-2">
            <Label className="text-spaceText">Monthly Hosting Cost (R)</Label>
            <Input 
              type="number"
              className="bg-space1 text-spaceText border-spaceAccent"
              value={formData.hostingCost}
              onChange={(e) => setFormData({...formData, hostingCost: parseInt(e.target.value)})}
            />
          </div>
        )}

        {/* Conditional Maintenance Section */}
        {showMaintenance && (
          <div className="space-y-2">
            <Label className="text-spaceText">Monthly Maintenance Cost (R)</Label>
            <Input 
              type="number"
              className="bg-space1 text-spaceText border-spaceAccent"
              value={formData.maintenanceCost}
              onChange={(e) => setFormData({...formData, maintenanceCost: parseInt(e.target.value)})}
            />
          </div>
        )}

        {/* Quote Preview */}
        <div className="mt-6 p-4 bg-space1 rounded-lg">
          <h3 className="text-spaceText font-semibold mb-2">Quote Preview</h3>
          <p className="text-spaceAccent text-2xl font-bold">
            R{calculateQuote().toLocaleString()}
          </p>
        </div>

        <GenerateQuoteButton 
        // @ts-expect-error was not working
          formData={formData} 
          calculateQuote={calculateQuote}
          projectId={formData.projectId}
          onSuccess={resetForm}
          company={formData.company}
        />
      </CardContent>
    </Card>
  )
}
