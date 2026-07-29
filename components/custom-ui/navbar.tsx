'use client'

import { Button } from "@/components/ui/button";
import { LayoutDashboard, LayoutGrid, LogOut, FileText, Calculator, Mail, Lock, Receipt } from "lucide-react";
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase/firebaseConfig';
import { toast } from 'sonner';
import Image from 'next/image';
import icon from '@/app/icon.png';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    // Navigating away used to leave the Firebase session intact, so the next
    // visit to /dashboard walked straight back in.
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Could not sign you out. Please try again.');
      return;
    }
    router.replace('/');
  };

  return (
    <aside className="hidden h-screen w-72 shrink-0 border-r border-spaceAccent/20 bg-space2/35 p-5 text-spaceText md:block">
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-8 rounded-2xl border border-spaceAccent/25 bg-space1/80 p-3">
          <div className="flex items-center gap-3">
            <Image src={icon} alt="Virtara Icon" width={34} height={34} />
            <div>
              <h1 className="virtara-display text-lg font-bold leading-tight">Virtara</h1>
              <p className="text-xs text-spaceAlt/80">Management System</p>
            </div>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-2 overflow-y-auto pr-1">
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'overview' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Overview
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'workspace' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('workspace')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Workspace
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'quotes' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('quotes')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Quotes
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'expenses' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              <Receipt className="mr-2 h-4 w-4" />
              Expenses
            </Button>
            <Button
              variant="ghost"
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'maintenance-table' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('maintenance-table')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Maintenance Table
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'subscriptions' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('subscriptions')}
            >
              <Mail className="mr-2 h-4 w-4" />
              Subscriptions
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'passwords' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('passwords')}
            >
              <Lock className="mr-2 h-4 w-4" />
              Passwords
            </Button>
            <div className="my-2 h-px bg-spaceAccent/30" />
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'generate-quote' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('generate-quote')}
            >
              <Calculator className="mr-2 h-4 w-4" />
              Generate Quote
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'letter-agreement' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('letter-agreement')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Letter Agreement
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start rounded-xl px-3 ${activeTab === 'maintenance-invoice' ? 'border border-spaceAccent/40 bg-linear-to-r from-spaceAccent/30 to-brand-blue/20 text-spaceText' : ''}`}
              onClick={() => setActiveTab('maintenance-invoice')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Maintenance Invoice
            </Button>
            
          </div>
          
          <div className="mt-3 border-t border-spaceAccent/20 pt-3">
            <Button 
              variant="ghost" 
              className="w-full justify-start rounded-xl px-3 text-red-300 hover:bg-red-500/15 hover:text-red-200"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </nav>
      </div>
    </aside>
  );
}
