"use client"

import { useState, Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import dynamic from 'next/dynamic'

// Dynamic imports with loading fallbacks
const Navbar = dynamic(() => import('./custom-ui/navbar'), {
  loading: () => <div>Loading...</div>
})
const ProjectsTable = dynamic(() => import('./custom-ui/projects-table'), {
  loading: () => <div>Loading...</div>
})
const CustomersTable = dynamic(() => import('./custom-ui/customers-table'), {
  loading: () => <div>Loading...</div>
})
const OverviewSection = dynamic(() => import('./custom-ui/overview-section'), {
  loading: () => <div>Loading...</div>
})
const GenerateQuote = dynamic(() => import('./custom-ui/generate-quote'), {
  loading: () => <div>Loading...</div>
})
const Quotes = dynamic(() => import('./custom-ui/quotes'), {
  loading: () => <div>Loading...</div>
})
const Subscriptions = dynamic(() => import('./custom-ui/subcriptions'), {
  loading: () => <div>Loading...</div>
})
const LetterAgreement = dynamic(() => import('./custom-ui/letter-agreement'), {
  loading: () => <div>Loading...</div>
})
const MaintenanceInvoice = dynamic(() => import('./custom-ui/maintenance-invoice'), {
  loading: () => <div>Loading...</div>
})
const MaintenanceTable = dynamic(() => import('./custom-ui/maintenance-table'), {
  loading: () => <div>Loading...</div>
})

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="flex max-h-screen bg-bg_color text-spaceText">
      <Suspense fallback={<div>Loading...</div>}>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-1 overflow-auto p-8">
          <Tabs value={activeTab} className="space-y-4">
            <TabsList className='bg-space2 text-spaceText'>
              <TabsTrigger value="overview" onClick={() => setActiveTab('overview')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Overview</TabsTrigger>
              <TabsTrigger value="customers" onClick={() => setActiveTab('customers')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Customers</TabsTrigger>
              <TabsTrigger value="projects" onClick={() => setActiveTab('projects')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Projects</TabsTrigger>
              <TabsTrigger value="quotes" onClick={() => setActiveTab('quotes')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Quotes</TabsTrigger>
              <TabsTrigger value="maintenance-table" onClick={() => setActiveTab('maintenance-table')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Maintenance Table</TabsTrigger>
              <TabsTrigger value="subscriptions" onClick={() => setActiveTab('subscriptions')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Subscriptions</TabsTrigger>
              
              {/* <TabsTrigger value="generate-quote" onClick={() => setActiveTab('generate-quote')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Generate Quote</TabsTrigger>
              <TabsTrigger value="letter-agreement" onClick={() => setActiveTab('letter-agreement')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Letter Agreement</TabsTrigger> */}
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
            <TabsContent value="letter-agreement" className="space-y-4">
              <LetterAgreement />
            </TabsContent>
            <TabsContent value="quotes" className="space-y-4">
              <Quotes />
            </TabsContent>
            <TabsContent value="subscriptions" className="space-y-4">
              <Subscriptions />
            </TabsContent>
            <TabsContent value="maintenance-table" className="space-y-4">
              <MaintenanceTable />
            </TabsContent>
            <TabsContent value="maintenance-invoice" className="space-y-4">
              <MaintenanceInvoice />
            </TabsContent>
          </Tabs>
        </div>
      </Suspense>
    </div>
  )
}