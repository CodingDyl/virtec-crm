"use client"

import { useState, Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import dynamic from 'next/dynamic'

// Dynamic imports with loading fallbacks
const Navbar = dynamic(() => import('./custom-ui/navbar'), {
  loading: () => <div>Loading...</div>
})
const Workspace = dynamic(() => import('./custom-ui/workspace/Workspace'), {
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
const PasswordsPage = dynamic(() => import('../app/passwords/page'), {
  loading: () => <div>Loading...</div>
})

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="flex h-screen overflow-hidden bg-bg_color text-spaceText">
      <Suspense fallback={<div>Loading...</div>}>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="h-screen flex-1 overflow-y-auto p-4 md:p-8">
          <header className="mb-6 rounded-[26px] border border-spaceAccent/20 bg-space2/50 px-5 py-4">
            <h1 className="virtara-display text-2xl md:text-3xl">Virtara CRM</h1>
            <p className="mt-1 text-sm text-spaceAlt/90">
              Track operations, revenue, and client delivery from one workspace.
            </p>
          </header>
          <Tabs value={activeTab} className="space-y-4 pb-6">
            <TabsList className='h-auto w-full justify-start gap-1 overflow-x-auto whitespace-nowrap bg-space2/70 text-spaceText'>
              <TabsTrigger value="overview" onClick={() => setActiveTab('overview')}>Overview</TabsTrigger>
              <TabsTrigger value="workspace" onClick={() => setActiveTab('workspace')}>Workspace</TabsTrigger>
              <TabsTrigger value="quotes" onClick={() => setActiveTab('quotes')}>Quotes</TabsTrigger>
              <TabsTrigger value="maintenance-table" onClick={() => setActiveTab('maintenance-table')}>Maintenance Table</TabsTrigger>
              <TabsTrigger value="subscriptions" onClick={() => setActiveTab('subscriptions')}>Subscriptions</TabsTrigger>
              <TabsTrigger value="passwords" onClick={() => setActiveTab('passwords')}>Passwords</TabsTrigger>

              {/* <TabsTrigger value="generate-quote" onClick={() => setActiveTab('generate-quote')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Generate Quote</TabsTrigger>
              <TabsTrigger value="letter-agreement" onClick={() => setActiveTab('letter-agreement')} className='hover:bg-spaceAlt active:bg-spaceAccent'>Letter Agreement</TabsTrigger> */}
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <OverviewSection />
            </TabsContent>
            <TabsContent value="workspace" className="space-y-4">
              <Workspace />
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
            <TabsContent value="passwords" className="space-y-4">
              <PasswordsPage />
            </TabsContent>
          </Tabs>
        </main>
      </Suspense>
    </div>
  )
}
