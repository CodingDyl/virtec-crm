"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Navbar from './custom-ui/navbar'
import ProjectsTable from './custom-ui/projects-table'
import CustomersTable from './custom-ui/customers-table'
import OverviewSection from './custom-ui/overview-section'
import GenerateQuote from './custom-ui/generate-quote'
import Quotes from './custom-ui/quotes'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Pass state to Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <Tabs value={activeTab} className="space-y-4">
          <TabsList className='bg-space2 text-spaceText'>
            <TabsTrigger value="overview" onClick={() => setActiveTab('overview')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Overview</TabsTrigger>
            <TabsTrigger value="customers" onClick={() => setActiveTab('customers')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Customers</TabsTrigger>
            <TabsTrigger value="projects" onClick={() => setActiveTab('projects')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Projects</TabsTrigger>
            <TabsTrigger value="quotes" onClick={() => setActiveTab('quotes')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Quotes</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <OverviewSection />
          </TabsContent>
          <TabsContent value="customers" className="space-y-4">
            <CustomersTable />
          </TabsContent>
          <TabsContent value="projects" className="space-y-4">
            <ProjectsTable />
          </TabsContent>
          <TabsContent value="generate-quote" className="space-y-4">
            <GenerateQuote />
          </TabsContent>
          <TabsContent value="quotes" className="space-y-4">
            <Quotes />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}