"use client"

import React, { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Settings,
  Users,
  Database,
  Shield,
  Plus,
  Edit,
  Trash2,
  Crown,
  User,
  Key,
  Mail,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Apple,
  Archive,
  ArchiveRestore,
  X,
  XCircle
} from "lucide-react"
import { trpc } from "@/utils/trpc"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Form schemas
const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "operator"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

const appleVarietySchema = z.object({
  name: z.string().min(1, "Name is required"),
})

const renameVarietySchema = z.object({
  name: z.string().min(1, "Name is required"),
})

type NotificationType = {
  id: number
  type: 'success' | 'error'
  title: string
  message: string
}

type UserForm = z.infer<typeof userSchema>
type AppleVarietyForm = z.infer<typeof appleVarietySchema>

function UserManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Mock user data
  const users = [
    {
      id: "1",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      isActive: true,
      lastLogin: "2024-01-27 10:30",
      createdAt: "2024-01-01"
    },
    {
      id: "2",
      email: "operator@example.com", 
      name: "Operator User",
      role: "operator",
      isActive: true,
      lastLogin: "2024-01-26 16:45",
      createdAt: "2024-01-05"
    },
    {
      id: "3",
      email: "john.cellar@cidery.com",
      name: "John Smith",
      role: "operator", 
      isActive: false,
      lastLogin: "2024-01-20 09:15",
      createdAt: "2024-01-10"
    }
  ]

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset
  } = useForm<UserForm>({
    resolver: zodResolver(userSchema)
  })

  const onSubmit = (data: UserForm) => {
    console.log("User data:", data)
    // TODO: Implement user creation mutation
    setIsAddDialogOpen(false)
    reset()
  }

  const promoteUser = (userId: string, currentRole: string) => {
    console.log(`Promoting user ${userId} from ${currentRole}`)
    // TODO: Implement user role update
  }

  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    console.log(`${currentStatus ? 'Deactivating' : 'Activating'} user ${userId}`)
    // TODO: Implement user status toggle
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              User Management
            </CardTitle>
            <CardDescription>Manage system users and their permissions</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new system user with appropriate permissions.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email"
                    {...register("email")} 
                    placeholder="user@example.com"
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    {...register("name")} 
                    placeholder="John Smith"
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select onValueChange={(value: "admin" | "operator") => setValue("role", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role.message}</p>}
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"}
                      {...register("password")} 
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>}
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Create User
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      user.role === "admin" ? "bg-red-100" : "bg-blue-100"
                    }`}>
                      {user.role === "admin" ? (
                        <Crown className="w-4 h-4 text-red-600" />
                      ) : (
                        <User className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.role === "admin" 
                      ? "bg-red-100 text-red-800" 
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {user.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.isActive 
                      ? "bg-green-100 text-green-800" 
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{user.lastLogin}</TableCell>
                <TableCell className="text-sm">{user.createdAt}</TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promoteUser(user.id, user.role)}
                      disabled={user.role === "admin"}
                    >
                      <Shield className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleUserStatus(user.id, user.isActive)}
                    >
                      {user.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ReferenceValues() {
  const [activeSection, setActiveSection] = useState<"varieties" | "vessels" | "locations">("varieties")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [editingVariety, setEditingVariety] = useState<any>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [notifications, setNotifications] = useState<NotificationType[]>([])

  const addNotification = (type: 'success' | 'error', title: string, message: string) => {
    const id = Date.now()
    setNotifications(prev => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 5000)
  }

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // tRPC hooks
  const { data: varietiesData, refetch: refetchVarieties } = trpc.appleVariety.listAll.useQuery(
    { includeInactive: showInactive }
  )
  const appleVarieties = varietiesData?.appleVarieties || []

  const createVariety = trpc.appleVariety.create.useMutation({
    onSuccess: (result) => {
      refetchVarieties()
      setIsAddDialogOpen(false)
      addNotification('success', 'Variety Created', 'Variety created successfully')
      reset()
    },
    onError: (error) => {
      addNotification('error', 'Creation Failed', error.message)
    }
  })

  const renameVariety = trpc.appleVariety.update.useMutation({
    onSuccess: (result) => {
      refetchVarieties()
      setIsRenameDialogOpen(false)
      setEditingVariety(null)
      addNotification('success', 'Variety Renamed', result.message || 'Variety renamed successfully')
      renameReset()
    },
    onError: (error) => {
      addNotification('error', 'Rename Failed', error.message)
    }
  })

  const setActiveVariety = trpc.appleVariety.update.useMutation({
    onSuccess: (result) => {
      refetchVarieties()
      addNotification('success', 'Status Updated', result.message || 'Status updated successfully')
    },
    onError: (error) => {
      addNotification('error', 'Update Failed', error.message)
    }
  })

  // Form hooks
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<AppleVarietyForm>({
    resolver: zodResolver(appleVarietySchema)
  })

  const {
    register: renameRegister,
    handleSubmit: renameHandleSubmit,
    formState: { errors: renameErrors },
    reset: renameReset,
    setValue: renameSetValue
  } = useForm<AppleVarietyForm>({
    resolver: zodResolver(renameVarietySchema)
  })

  const onSubmit = (data: AppleVarietyForm) => {
    createVariety.mutate({
      name: data.name,
      ciderCategory: data.ciderCategory || undefined,
      tannin: data.tannin || undefined,
      acid: data.acid || undefined,
      sugarBrix: data.sugarBrix || undefined,
      harvestWindow: data.harvestWindow || undefined,
      varietyNotes: data.varietyNotes || undefined
    })
  }

  const onRenameSubmit = (data: AppleVarietyForm) => {
    if (editingVariety) {
      renameVariety.mutate({
        id: editingVariety.id,
        patch: {
          name: data.name,
          ciderCategory: undefined,
          tannin: undefined,
          acid: undefined,
          sugarBrix: undefined,
          harvestWindow: undefined,
          varietyNotes: undefined
        }
      })
    }
  }

  const handleRename = (variety: any) => {
    setEditingVariety(variety)
    renameSetValue('name', variety.name)
    setIsRenameDialogOpen(true)
  }

  const handleArchive = (variety: any) => {
    setActiveVariety.mutate({
      id: variety.id,
      patch: {
        isActive: false,
        ciderCategory: undefined,
        tannin: undefined,
        acid: undefined,
        sugarBrix: undefined,
        harvestWindow: undefined,
        varietyNotes: undefined
      }
    })
  }

  const handleRestore = (variety: any) => {
    setActiveVariety.mutate({
      id: variety.id,
      patch: {
        isActive: true,
        ciderCategory: undefined,
        tannin: undefined,
        acid: undefined,
        sugarBrix: undefined,
        harvestWindow: undefined,
        varietyNotes: undefined
      }
    })
  }

  const isActive = (variety: any) => !variety.deletedAt

  return (
    <>
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              min-w-80 max-w-md p-4 rounded-lg shadow-lg border
              ${notification.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {notification.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="text-sm mt-1 opacity-90">{notification.message}</p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Apple className="w-5 h-5 text-green-600" />
                Apple Varieties
              </CardTitle>
              <CardDescription>Manage the master list of apple varieties used throughout the system</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInactive(!showInactive)}
              >
                {showInactive ? "Hide Archived" : "Show Archived"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchVarieties()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Variety
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Apple Variety</DialogTitle>
                    <DialogDescription>
                      Create a new apple variety for use throughout the system.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Variety Name</Label>
                      <Input
                        id="name"
                        {...register("name")}
                        placeholder="e.g., Honeycrisp, Granny Smith"
                      />
                      {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createVariety.isPending}>
                        {createVariety.isPending ? "Creating..." : "Create Variety"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appleVarieties.map((variety) => (
                  <TableRow key={variety.id}>
                    <TableCell className="font-medium">{variety.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        isActive(variety)
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {isActive(variety) ? "Active" : "Archived"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {variety.createdAt ? new Date(variety.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRename(variety)}
                          title="Rename variety"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        {isActive(variety) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchive(variety)}
                            title="Archive variety"
                            className="text-orange-600 hover:text-orange-700"
                          >
                            <Archive className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(variety)}
                            title="Restore variety"
                            className="text-green-600 hover:text-green-700"
                          >
                            <ArchiveRestore className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {appleVarieties.map((variety) => (
              <Card key={variety.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{variety.name}</h3>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                        isActive(variety)
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {isActive(variety) ? "Active" : "Archived"}
                      </span>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRename(variety)}
                        title="Rename variety"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {isActive(variety) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleArchive(variety)}
                          title="Archive variety"
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(variety)}
                          title="Restore variety"
                          className="text-green-600 hover:text-green-700"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Created: {variety.createdAt ? new Date(variety.createdAt).toLocaleDateString() : "—"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {appleVarieties.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Apple className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No varieties found</h3>
              <p className="text-sm mb-4">
                {showInactive
                  ? "No apple varieties found. Add your first variety to get started."
                  : "No active varieties found. Try showing archived varieties or add a new one."
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Apple Variety</DialogTitle>
            <DialogDescription>
              Change the name of this apple variety. This will update all references throughout the system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={renameHandleSubmit(onRenameSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="rename-name">Variety Name</Label>
              <Input
                id="rename-name"
                {...renameRegister("name")}
                placeholder="Enter new name"
              />
              {renameErrors.name && <p className="text-sm text-red-600 mt-1">{renameErrors.name.message}</p>}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRenameDialogOpen(false)
                  setEditingVariety(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renameVariety.isPending}>
                {renameVariety.isPending ? "Renaming..." : "Rename Variety"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SystemSettings() {
  // Mock system settings
  const settings = [
    {
      id: "default_yield",
      name: "Default Apple Yield",
      value: "70%",
      description: "Expected juice yield percentage from apples"
    },
    {
      id: "fermentation_temp",
      name: "Fermentation Temperature Range",
      value: "16-20°C",
      description: "Optimal temperature range for fermentation"
    },
    {
      id: "package_loss",
      name: "Expected Packaging Loss",
      value: "2%",
      description: "Expected volume loss during packaging"
    },
    {
      id: "inventory_alert",
      name: "Low Inventory Alert",
      value: "100 bottles",
      description: "Alert threshold for low inventory"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-600" />
          System Settings
        </CardTitle>
        <CardDescription>Configure system-wide settings and defaults</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {settings.map((setting) => (
            <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-medium">{setting.name}</h4>
                <p className="text-sm text-gray-600">{setting.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Input 
                  value={setting.value} 
                  className="w-32 text-right"
                  readOnly
                />
                <Button size="sm" variant="outline">
                  <Edit className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "reference" | "settings">("users")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
          <p className="text-gray-600 mt-1">
            Manage users, reference data, and system configuration.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "users", label: "User Management", icon: Users },
            { key: "reference", label: "Reference Data", icon: Database },
            { key: "settings", label: "System Settings", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "users" && <UserManagement />}
          {activeTab === "reference" && <ReferenceValues />}
          {activeTab === "settings" && <SystemSettings />}
        </div>
      </main>
    </div>
  )
}