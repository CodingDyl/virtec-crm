'use client'

import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, BarChart3, LogOut } from "lucide-react";
import { useRouter } from 'next/navigation';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    // Add any logout logic here (clearing tokens, etc.)
    router.push('/');
  };

  return (
    <div className="w-64 bg-space1 p-4 border-r-2 border-spaceAccent text-spaceText h-screen">
      <div className="flex flex-col h-full">
        <h1 className="mb-8 text-2xl font-bold">Virtec Marketing</h1>
        <nav className="flex flex-col flex-1">
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${activeTab === 'overview' ? 'bg-spaceAccent' : ''} hover:bg-spaceAlt`}
              onClick={() => setActiveTab('overview')}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Overview
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${activeTab === 'customers' ? 'bg-spaceAccent' : ''} hover:bg-spaceAlt`}
              onClick={() => setActiveTab('customers')}
            >
              <Users className="mr-2 h-4 w-4" />
              Customers
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${activeTab === 'projects' ? 'bg-spaceAccent' : ''} hover:bg-spaceAlt`}
              onClick={() => setActiveTab('projects')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Projects
            </Button>
          </div>
          
          <div className="mt-auto">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-red-500 hover:bg-red-500/10 hover:text-red-500"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </nav>
      </div>
    </div>
  );
}

