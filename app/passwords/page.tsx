'use client'

import { useState, useEffect } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/firebaseConfig'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import { Eye, EyeOff, Copy, Edit, Trash2, Plus, Search, Shield, Key, Lock } from 'lucide-react'

interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  category: string;
  createdAt: any;
  updatedAt: any;
}

interface RecoveryCode {
  id: string;
  title: string;
  codes: string[];
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export default function PasswordsPage() {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [recoveryCodes, setRecoveryCodes] = useState<RecoveryCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showRecoveryCodes, setShowRecoveryCodes] = useState<Record<string, boolean>>({});

  // Modal states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | null>(null);
  const [editingRecovery, setEditingRecovery] = useState<RecoveryCode | null>(null);

  // Form states
  const [passwordForm, setPasswordForm] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    category: 'General'
  });

  const [recoveryForm, setRecoveryForm] = useState({
    title: '',
    codes: '',
    notes: ''
  });

  const categories = [
    'General',
    'Social Media',
    'Banking',
    'Email',
    'Work',
    'Shopping',
    'Entertainment',
    'Other'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch passwords
      const passwordsQuery = query(collection(db, "passwords"), orderBy("createdAt", "desc"));
      const passwordsSnapshot = await getDocs(passwordsQuery);
      const passwordsData = passwordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PasswordEntry[];
      setPasswords(passwordsData);

      // Fetch recovery codes
      const recoveryQuery = query(collection(db, "recovery_codes"), orderBy("createdAt", "desc"));
      const recoverySnapshot = await getDocs(recoveryQuery);
      const recoveryData = recoverySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecoveryCode[];
      setRecoveryCodes(recoveryData);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPassword = async () => {
    if (!passwordForm.title || !passwordForm.username || !passwordForm.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const passwordData = {
        ...passwordForm,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingPassword) {
        await updateDoc(doc(db, "passwords", editingPassword.id), {
          ...passwordData,
          updatedAt: serverTimestamp()
        });
        toast.success("Password updated successfully!");
      } else {
        await addDoc(collection(db, "passwords"), passwordData);
        toast.success("Password added successfully!");
      }

      setPasswordModalOpen(false);
      setEditingPassword(null);
      setPasswordForm({
        title: '',
        username: '',
        password: '',
        url: '',
        notes: '',
        category: 'General'
      });
      fetchData();
    } catch (error) {
      console.error("Error saving password:", error);
      toast.error("Failed to save password");
    }
  };

  const handleAddRecoveryCode = async () => {
    if (!recoveryForm.title || !recoveryForm.codes) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const codesArray = recoveryForm.codes.split('\n').filter(code => code.trim());
      
      const recoveryData = {
        title: recoveryForm.title,
        codes: codesArray,
        notes: recoveryForm.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (editingRecovery) {
        await updateDoc(doc(db, "recovery_codes", editingRecovery.id), {
          ...recoveryData,
          updatedAt: serverTimestamp()
        });
        toast.success("Recovery codes updated successfully!");
      } else {
        await addDoc(collection(db, "recovery_codes"), recoveryData);
        toast.success("Recovery codes added successfully!");
      }

      setRecoveryModalOpen(false);
      setEditingRecovery(null);
      setRecoveryForm({
        title: '',
        codes: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error("Error saving recovery codes:", error);
      toast.error("Failed to save recovery codes");
    }
  };

  const handleDeletePassword = async (id: string) => {
    if (confirm("Are you sure you want to delete this password?")) {
      try {
        await deleteDoc(doc(db, "passwords", id));
        toast.success("Password deleted successfully!");
        fetchData();
      } catch (error) {
        console.error("Error deleting password:", error);
        toast.error("Failed to delete password");
      }
    }
  };

  const handleDeleteRecoveryCode = async (id: string) => {
    if (confirm("Are you sure you want to delete these recovery codes?")) {
      try {
        await deleteDoc(doc(db, "recovery_codes", id));
        toast.success("Recovery codes deleted successfully!");
        fetchData();
      } catch (error) {
        console.error("Error deleting recovery codes:", error);
        toast.error("Failed to delete recovery codes");
      }
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleRecoveryCodesVisibility = (id: string) => {
    setShowRecoveryCodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${type} copied to clipboard!`);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const openEditPassword = (password: PasswordEntry) => {
    setEditingPassword(password);
    setPasswordForm({
      title: password.title,
      username: password.username,
      password: password.password,
      url: password.url || '',
      notes: password.notes || '',
      category: password.category
    });
    setPasswordModalOpen(true);
  };

  const openEditRecovery = (recovery: RecoveryCode) => {
    setEditingRecovery(recovery);
    setRecoveryForm({
      title: recovery.title,
      codes: recovery.codes.join('\n'),
      notes: recovery.notes || ''
    });
    setRecoveryModalOpen(true);
  };

  const filteredPasswords = passwords.filter(password => {
    const matchesSearch = password.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.url?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || password.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredRecoveryCodes = recoveryCodes.filter(recovery => {
    return recovery.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 gap-4">
        <Quantum
          size="100"
          speed="1.75"
          color="white" 
        />
        <p className="text-spaceText">Loading passwords and recovery codes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-spaceText">Password Manager</h1>
          <p className="text-spaceText/70 mt-2">Securely store and manage your passwords and recovery codes</p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => setPasswordModalOpen(true)}
            className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Password
          </Button>
          <Button
            onClick={() => setRecoveryModalOpen(true)}
            className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
          >
            <Key className="w-4 h-4 mr-2" />
            Add Recovery Codes
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-spaceText/50 w-4 h-4" />
            <Input
              placeholder="Search passwords and recovery codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-space1 text-spaceText border-spaceAccent"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-10 rounded-md border border-spaceAccent bg-space1 px-3 text-spaceText"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-space2 border-spaceAccent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70">Total Passwords</p>
                <p className="text-2xl font-bold text-spaceText">{passwords.length}</p>
              </div>
              <Lock className="w-8 h-8 text-spaceAccent" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-space2 border-spaceAccent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70">Recovery Codes</p>
                <p className="text-2xl font-bold text-spaceText">{recoveryCodes.length}</p>
              </div>
              <Key className="w-8 h-8 text-spaceAccent" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-space2 border-spaceAccent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-spaceText/70">Categories</p>
                <p className="text-2xl font-bold text-spaceText">{categories.length}</p>
              </div>
              <Shield className="w-8 h-8 text-spaceAccent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Passwords Table */}
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader>
          <CardTitle className="text-spaceText">Passwords</CardTitle>
          <CardDescription className="text-spaceText/70">
            Manage your stored passwords and credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-spaceAccent">
            <Table>
              <TableHeader>
                <TableRow className="bg-space1">
                  <TableHead className="text-spaceText">Title</TableHead>
                  <TableHead className="text-spaceText">Username</TableHead>
                  <TableHead className="text-spaceText">Password</TableHead>
                  <TableHead className="text-spaceText">Category</TableHead>
                  <TableHead className="text-spaceText">URL</TableHead>
                  <TableHead className="text-spaceText">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPasswords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-spaceText py-8">
                      No passwords found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPasswords.map((password) => (
                    <TableRow key={password.id} className="hover:bg-space1">
                      <TableCell className="text-spaceText font-medium">
                        {password.title}
                      </TableCell>
                      <TableCell className="text-spaceText">
                        <div className="flex items-center space-x-2">
                          <span>{password.username}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(password.username, 'Username')}
                            className="h-6 w-6 p-0 text-spaceAccent hover:text-spaceAlt"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-spaceText">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono">
                            {showPasswords[password.id] ? password.password : '••••••••'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePasswordVisibility(password.id)}
                            className="h-6 w-6 p-0 text-spaceAccent hover:text-spaceAlt"
                          >
                            {showPasswords[password.id] ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(password.password, 'Password')}
                            className="h-6 w-6 p-0 text-spaceAccent hover:text-spaceAlt"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-spaceAccent text-space1">
                          {password.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-spaceText">
                        {password.url ? (
                          <a
                            href={password.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            Visit
                          </a>
                        ) : (
                          <span className="text-spaceText/50">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditPassword(password)}
                            className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePassword(password.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Codes Table */}
      <Card className="bg-space2 border-spaceAccent">
        <CardHeader>
          <CardTitle className="text-spaceText">Recovery Codes</CardTitle>
          <CardDescription className="text-spaceText/70">
            Manage your backup and recovery codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-spaceAccent">
            <Table>
              <TableHeader>
                <TableRow className="bg-space1">
                  <TableHead className="text-spaceText">Title</TableHead>
                  <TableHead className="text-spaceText">Codes</TableHead>
                  <TableHead className="text-spaceText">Notes</TableHead>
                  <TableHead className="text-spaceText">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecoveryCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-spaceText py-8">
                      No recovery codes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecoveryCodes.map((recovery) => (
                    <TableRow key={recovery.id} className="hover:bg-space1">
                      <TableCell className="text-spaceText font-medium">
                        {recovery.title}
                      </TableCell>
                      <TableCell className="text-spaceText">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono">
                            {showRecoveryCodes[recovery.id] 
                              ? recovery.codes.join(', ')
                              : `${recovery.codes.length} codes hidden`
                            }
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRecoveryCodesVisibility(recovery.id)}
                            className="h-6 w-6 p-0 text-spaceAccent hover:text-spaceAlt"
                          >
                            {showRecoveryCodes[recovery.id] ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(recovery.codes.join('\n'), 'Recovery Codes')}
                            className="h-6 w-6 p-0 text-spaceAccent hover:text-spaceAlt"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-spaceText">
                        {recovery.notes || <span className="text-spaceText/50">-</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditRecovery(recovery)}
                            className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRecoveryCode(recovery.id)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Password Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">
              {editingPassword ? 'Edit Password' : 'Add New Password'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-spaceText">Title *</Label>
              <Input
                id="title"
                value={passwordForm.title}
                onChange={(e) => setPasswordForm({ ...passwordForm, title: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="e.g., Gmail Account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username" className="text-spaceText">Username/Email *</Label>
              <Input
                id="username"
                value={passwordForm.username}
                onChange={(e) => setPasswordForm({ ...passwordForm, username: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="username@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-spaceText">Password *</Label>
              <Input
                id="password"
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url" className="text-spaceText">Website URL</Label>
              <Input
                id="url"
                type="url"
                value={passwordForm.url}
                onChange={(e) => setPasswordForm({ ...passwordForm, url: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category" className="text-spaceText">Category</Label>
              <select
                id="category"
                value={passwordForm.category}
                onChange={(e) => setPasswordForm({ ...passwordForm, category: e.target.value })}
                className="w-full h-10 rounded-md border border-spaceAccent bg-space1 px-3 text-spaceText"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-spaceText">Notes</Label>
              <Textarea
                id="notes"
                value={passwordForm.notes}
                onChange={(e) => setPasswordForm({ ...passwordForm, notes: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setPasswordModalOpen(false);
                setEditingPassword(null);
                setPasswordForm({
                  title: '',
                  username: '',
                  password: '',
                  url: '',
                  notes: '',
                  category: 'General'
                });
              }}
              className="bg-space1 text-spaceText border-spaceAccent hover:bg-spaceAlt"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddPassword}
              className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
            >
              {editingPassword ? 'Update Password' : 'Add Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recovery Codes Modal */}
      <Dialog open={recoveryModalOpen} onOpenChange={setRecoveryModalOpen}>
        <DialogContent className="bg-space2 border-spaceAccent">
          <DialogHeader>
            <DialogTitle className="text-spaceText">
              {editingRecovery ? 'Edit Recovery Codes' : 'Add Recovery Codes'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recoveryTitle" className="text-spaceText">Title *</Label>
              <Input
                id="recoveryTitle"
                value={recoveryForm.title}
                onChange={(e) => setRecoveryForm({ ...recoveryForm, title: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="e.g., Google 2FA Backup Codes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codes" className="text-spaceText">Recovery Codes *</Label>
              <Textarea
                id="codes"
                value={recoveryForm.codes}
                onChange={(e) => setRecoveryForm({ ...recoveryForm, codes: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent font-mono"
                placeholder="Enter each code on a new line&#10;ABC123DEF456&#10;GHI789JKL012&#10;MNO345PQR678"
                rows={6}
              />
              <p className="text-xs text-spaceText/50">
                Enter each recovery code on a separate line
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recoveryNotes" className="text-spaceText">Notes</Label>
              <Textarea
                id="recoveryNotes"
                value={recoveryForm.notes}
                onChange={(e) => setRecoveryForm({ ...recoveryForm, notes: e.target.value })}
                className="bg-space1 text-spaceText border-spaceAccent"
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setRecoveryModalOpen(false);
                setEditingRecovery(null);
                setRecoveryForm({
                  title: '',
                  codes: '',
                  notes: ''
                });
              }}
              className="bg-space1 text-spaceText border-spaceAccent hover:bg-spaceAlt"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddRecoveryCode}
              className="bg-spaceAccent text-space1 hover:bg-spaceAlt"
            >
              {editingRecovery ? 'Update Recovery Codes' : 'Add Recovery Codes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
