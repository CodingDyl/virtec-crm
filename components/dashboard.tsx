"use client"

import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, BarChart3, DollarSign, LayoutDashboard, Settings, Users } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
// import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock data
const revenueData = [
  { name: 'Jan', total: 15000 },
  { name: 'Feb', total: 20000 },
  { name: 'Mar', total: 18000 },
  { name: 'Apr', total: 25000 },
  { name: 'May', total: 30000 },
  { name: 'Jun', total: 28000 },
]

const customers = [
  { name: 'Alice Johnson', email: 'alice@example.com', totalSpent: 5000, status: 'Active' },
  { name: 'Bob Smith', email: 'bob@example.com', totalSpent: 3500, status: 'Inactive' },
  { name: 'Charlie Brown', email: 'charlie@example.com', totalSpent: 7500, status: 'Active' },
  { name: 'Diana Ross', email: 'diana@example.com', totalSpent: 6000, status: 'Active' },
  { name: 'Edward Norton', email: 'edward@example.com', totalSpent: 4500, status: 'Inactive' },
]

const projects = [
  { name: 'Website Redesign', client: 'TechCorp', status: 'In Progress', completion: 75 },
  { name: 'SEO Campaign', client: 'GreenEnergy', status: 'Planning', completion: 10 },
  { name: 'Social Media Strategy', client: 'FashionBrand', status: 'Completed', completion: 100 },
  { name: 'E-commerce Platform', client: 'LocalShop', status: 'In Progress', completion: 60 },
]

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4">
        <h1 className="mb-8 text-2xl font-bold">Virtec Marketing</h1>
        <nav className="space-y-2">
          <Button variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('overview')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Overview
          </Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('customers')}>
            <Users className="mr-2 h-4 w-4" />
            Customers
          </Button>
          <Button variant="ghost" className="w-full justify-start" onClick={() => setActiveTab('projects')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Projects
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8">
        <Tabs value={activeTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$45,231.89</div>
                  <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    +2 new this month
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+573</div>
                  <p className="text-xs text-muted-foreground">
                    +201 since last quarter
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">15.2%</div>
                  <p className="text-xs text-muted-foreground">
                    +2.4% from last week
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4 bg-gray-800">
                <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={revenueData}>
                      <XAxis
                        dataKey="name"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Bar dataKey="total" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="col-span-3 bg-gray-800">
                <CardHeader>
                  <CardTitle>Recent Customers</CardTitle>
                  <CardDescription>
                    You have {customers.length} total customers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {customers.map((customer) => (
                      <div key={customer.email} className="mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                        <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="customers" className="space-y-4">
            <Card className="bg-gray-800">
              <CardHeader>
                <CardTitle>Customer Overview</CardTitle>
                <CardDescription>
                  A list of all customers and their current status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Total Spent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.email}>
                        <TableCell>{customer.name}</TableCell>
                        <TableCell>{customer.email}</TableCell>
                        <TableCell>${customer.totalSpent.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                            {customer.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="projects" className="space-y-4">
            <Card className="bg-gray-800">
              <CardHeader>
                <CardTitle>Project Overview</CardTitle>
                <CardDescription>
                  A list of all current projects and their status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.name}>
                        <TableCell>{project.name}</TableCell>
                        <TableCell>{project.client}</TableCell>
                        <TableCell>
                          <Badge variant={project.status === 'Completed' ? 'default' : 'secondary'}>
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div
                              className="bg-blue-600 h-2.5 rounded-full"
                              style={{ width: `${project.completion}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400">{project.completion}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}