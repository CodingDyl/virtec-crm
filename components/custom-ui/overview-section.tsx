'use client'

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DollarSign, BarChart3, Users, ArrowUpRight } from "lucide-react";
import { revenueData } from "@/constants";
import { customers } from "@/constants";
import { Bar, BarChart } from "recharts";
import { ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area"

export default function OverviewSection() {
  return (
    <>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-space2 text-spaceText border-spaceAccent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground text-spaceAccent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$45,231.89</div>
                  <p className="text-xs text-muted-foreground text-spaceAccent">
                    +20.1% from last month
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-space2 text-spaceText border-spaceAccent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground text-spaceAccent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground text-spaceAccent">
                    +2 new this month
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-space2 text-spaceText border-spaceAccent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Customers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground text-spaceAccent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+573</div>
                  <p className="text-xs text-muted-foreground text-spaceAccent">
                    +201 since last quarter
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-space2 text-spaceText border-spaceAccent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground text-spaceAccent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">15.2%</div>
                  <p className="text-xs text-muted-foreground text-spaceAccent">
                    +2.4% from last week
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4 bg-space2 text-spaceText border-spaceAccent">
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
                      <Bar dataKey="total" fill="#f9b17a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="col-span-3 bg-space2 text-spaceText border-spaceAccent">
                <CardHeader>
                  <CardTitle>Recent Customers</CardTitle>
                  <CardDescription className="text-spaceAlt">
                    You have {customers.length} total customers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {customers.map((customer) => (
                      <div key={customer.email} className="mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                        <span className="flex h-2 w-2 translate-y-1 rounded-full bg-spaceAccent" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{customer.name}</p>
                          <p className="text-sm text-muted-foreground text-spaceAlt">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            </>
  )
}