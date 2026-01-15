"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  XCircle,
  CreditCard,
  UserCheck,
  UserX,
  Monitor,
  Calendar,
  Clock,
  Palette,
  DollarSign,
  Ruler,
  Droplet,
  Scale,
  Thermometer,
  Gauge,
  Building2,
  Bell,
  Beaker,
  Package,
  Lock,
  Loader2,
  Upload,
  Globe,
  Phone,
  MapPin,
  FileText,
  Hash,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { api } from "@/server/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDate } from "@/utils/date-format";
import { useToast } from "@/hooks/use-toast";
import { SquareIntegration } from "@/components/admin/SquareIntegration";
import { WorkersManagement } from "@/components/admin/WorkersManagement";
import { OverheadSettings } from "@/components/admin/OverheadSettings";
import { MeasurementSchedulesSettings } from "@/components/admin/MeasurementSchedulesSettings";
import { BarrelOriginTypesManagement } from "@/components/cellar/BarrelOriginTypesManagement";
import { CalibrationSettings } from "@/components/admin/CalibrationSettings";
import { TTBOpeningBalancesSettings } from "@/components/admin/TTBOpeningBalancesSettings";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

// Form schemas
const userSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["admin", "operator"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const appleVarietySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

const renameVarietySchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type NotificationType = {
  id: number;
  type: "success" | "error";
  title: string;
  message: string;
};

type UserForm = z.infer<typeof userSchema>;
type AppleVarietyForm = z.infer<typeof appleVarietySchema>;

function UserManagement() {
  const { data: session } = useSession();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch users from real API
  const { data: users, refetch, isLoading } = api.user.listUsers.useQuery();

  // Update user mutation
  const updateUserMutation = api.user.updateUser.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    },
  });

  const handleRoleChange = (userId: string, role: "admin" | "operator" | "viewer") => {
    updateUserMutation.mutate({ userId, role });
  };

  const handleStatusToggle = (userId: string, isActive: boolean) => {
    updateUserMutation.mutate({ userId, isActive });
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      admin: "destructive",
      operator: "default",
      viewer: "secondary",
    };
    return (
      <Badge variant={variants[role] || "default"}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <UserCheck className="h-3 w-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="outline" className="border-red-500 text-red-600">
        <UserX className="h-3 w-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                User Management
              </CardTitle>
              <CardDescription>
                {users?.length || 0} registered users
              </CardDescription>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              Loading users...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user.isActive)}</TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? formatDate(user.lastLoginAt)
                        : "Never"
                      }
                    </TableCell>
                    <TableCell>
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsEditDialogOpen(true);
                        }}
                        variant="ghost"
                        size="sm"
                        disabled={user.id === session?.user?.id}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Manage user role and status for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <p className="text-sm text-gray-600">{selectedUser.email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value) =>
                    handleRoleChange(selectedUser.id, value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Admin: Full access | Operator: Create/Edit | Viewer: Read-only
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Account Status</label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {selectedUser.isActive ? "Active" : "Inactive"}
                  </span>
                  <Switch
                    checked={selectedUser.isActive}
                    onCheckedChange={(checked) =>
                      handleStatusToggle(selectedUser.id, checked)
                    }
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Inactive users cannot sign in
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferenceValues() {
  const [activeSection, setActiveSection] = useState<
    "varieties" | "vessels" | "locations"
  >("varieties");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  const addNotification = (
    type: "success" | "error",
    title: string,
    message: string,
  ) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // tRPC hooks
  const { data: varietiesData, refetch: refetchVarieties } =
    trpc.fruitVariety.listAll.useQuery({ includeInactive: showInactive });
  const appleVarieties = varietiesData?.appleVarieties || [];

  const createVariety = trpc.fruitVariety.create.useMutation({
    onSuccess: (result) => {
      refetchVarieties();
      setIsAddDialogOpen(false);
      addNotification(
        "success",
        "Variety Created",
        "Variety created successfully",
      );
      reset();
    },
    onError: (error) => {
      addNotification("error", "Creation Failed", error.message);
    },
  });

  const renameVariety = trpc.fruitVariety.update.useMutation({
    onSuccess: (result) => {
      refetchVarieties();
      setIsRenameDialogOpen(false);
      setEditingVariety(null);
      addNotification(
        "success",
        "Variety Renamed",
        result.message || "Variety renamed successfully",
      );
      renameReset();
    },
    onError: (error) => {
      addNotification("error", "Rename Failed", error.message);
    },
  });

  const setActiveVariety = trpc.fruitVariety.update.useMutation({
    onSuccess: (result) => {
      refetchVarieties();
      addNotification(
        "success",
        "Status Updated",
        result.message || "Status updated successfully",
      );
    },
    onError: (error) => {
      addNotification("error", "Update Failed", error.message);
    },
  });

  // Form hooks
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AppleVarietyForm>({
    resolver: zodResolver(appleVarietySchema),
  });

  const {
    register: renameRegister,
    handleSubmit: renameHandleSubmit,
    formState: { errors: renameErrors },
    reset: renameReset,
    setValue: renameSetValue,
  } = useForm<AppleVarietyForm>({
    resolver: zodResolver(renameVarietySchema),
  });

  const onSubmit = (data: AppleVarietyForm) => {
    createVariety.mutate({
      name: data.name,
      ciderCategory: undefined,
      tannin: undefined,
      acid: undefined,
      sugarBrix: undefined,
      harvestWindow: undefined,
      varietyNotes: undefined,
    });
  };

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
          varietyNotes: undefined,
        },
      });
    }
  };

  const handleRename = (variety: any) => {
    setEditingVariety(variety);
    renameSetValue("name", variety.name);
    setIsRenameDialogOpen(true);
  };

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
        varietyNotes: undefined,
      },
    });
  };

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
        varietyNotes: undefined,
      },
    });
  };

  const isActive = (variety: any) => !variety.deletedAt;

  return (
    <>
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              min-w-80 max-w-md p-4 rounded-lg shadow-lg border
              ${
                notification.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {notification.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{notification.title}</p>
                <p className="text-sm mt-1 opacity-90">
                  {notification.message}
                </p>
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
              <CardDescription>
                Manage the master list of apple varieties used throughout the
                system
              </CardDescription>
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
                      {errors.name && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.name.message}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createVariety.isPending}>
                        {createVariety.isPending
                          ? "Creating..."
                          : "Create Variety"}
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
                    <TableCell className="font-medium">
                      {variety.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          isActive(variety)
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {isActive(variety) ? "Active" : "Archived"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {variety.createdAt
                        ? formatDate(new Date(variety.createdAt))
                        : "—"}
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
                      <h3 className="font-medium text-gray-900">
                        {variety.name}
                      </h3>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                          isActive(variety)
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
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
                    <p>
                      Created:{" "}
                      {variety.createdAt
                        ? formatDate(new Date(variety.createdAt))
                        : "—"}
                    </p>
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
                  : "No active varieties found. Try showing archived varieties or add a new one."}
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
              Change the name of this apple variety. This will update all
              references throughout the system.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={renameHandleSubmit(onRenameSubmit)}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="rename-name">Variety Name</Label>
              <Input
                id="rename-name"
                {...renameRegister("name")}
                placeholder="Enter new name"
              />
              {renameErrors.name && (
                <p className="text-sm text-red-600 mt-1">
                  {renameErrors.name.message}
                </p>
              )}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRenameDialogOpen(false);
                  setEditingVariety(null);
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
  );
}

// Helper component for disabled/not implemented settings
function DisabledOverlay({ children, implemented = false }: { children: React.ReactNode; implemented?: boolean }) {
  if (implemented) return <>{children}</>;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gray-100/60 z-10 rounded-lg flex items-center justify-center">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Coming Soon
        </Badge>
      </div>
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
    </div>
  );
}

// Section header with implementation status
function SettingsSectionHeader({
  title,
  description,
  icon: Icon,
  implemented = false
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  implemented?: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          implemented ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {!implemented && (
        <Badge variant="outline" className="text-gray-400">
          Not Implemented
        </Badge>
      )}
    </div>
  );
}

function BusinessProfile() {
  const { settings, isLoading, refetch } = useSettings();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    logo: "",
    ubiNumber: "",
    einNumber: "",
    ttbPermitNumber: "",
    stateLicenseNumber: "",
  });

  // Update form when settings load
  React.useEffect(() => {
    if (!isLoading && settings) {
      setFormData({
        name: settings.name || "",
        address: settings.address || "",
        email: settings.email || "",
        phone: settings.phone || "",
        website: settings.website || "",
        logo: settings.logo || "",
        ubiNumber: settings.ubiNumber || "",
        einNumber: settings.einNumber || "",
        ttbPermitNumber: settings.ttbPermitNumber || "",
        stateLicenseNumber: settings.stateLicenseNumber || "",
      });
      setLogoPreview(settings.logo || null);
    }
  }, [isLoading, settings]);

  const updateSettingsMutation = trpc.settings.updateOrganizationSettings.useMutation({
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your business profile has been saved.",
      });
      refetch();
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 500KB for base64 storage)
    if (file.size > 500 * 1024) {
      toast({
        title: "File Too Large",
        description: "Logo must be less than 500KB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLogoPreview(dataUrl);
      setFormData(prev => ({ ...prev, logo: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logo: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettingsMutation.mutateAsync({
        name: formData.name || undefined,
        address: formData.address || null,
        email: formData.email || null,
        phone: formData.phone || null,
        website: formData.website || null,
        logo: formData.logo || null,
        ubiNumber: formData.ubiNumber || null,
        einNumber: formData.einNumber || null,
        ttbPermitNumber: formData.ttbPermitNumber || null,
        stateLicenseNumber: formData.stateLicenseNumber || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to saved settings
    setFormData({
      name: settings.name || "",
      address: settings.address || "",
      email: settings.email || "",
      phone: settings.phone || "",
      website: settings.website || "",
      logo: settings.logo || "",
      ubiNumber: settings.ubiNumber || "",
      einNumber: settings.einNumber || "",
      ttbPermitNumber: settings.ttbPermitNumber || "",
      stateLicenseNumber: settings.stateLicenseNumber || "",
    });
    setLogoPreview(settings.logo || null);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <SettingsSectionHeader
            title="Business Profile"
            description="Your cidery information for invoices and receipts"
            icon={Building2}
            implemented={true}
          />
          {!isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Section */}
        <div className="flex items-start gap-6 p-4 border rounded-lg bg-gray-50">
          <div className="flex-shrink-0">
            {logoPreview ? (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Cidery Logo"
                  className="w-24 h-24 object-contain rounded-lg border bg-white"
                />
                {isEditing && (
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    title="Remove logo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed rounded-lg bg-white text-gray-400">
                <Building2 className="w-8 h-8" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h4 className="font-medium">Company Logo</h4>
            <p className="text-sm text-gray-600 mt-1">
              Used on invoices, receipts, and other documents
            </p>
            {isEditing && (
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </Button>
                <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 500KB. Recommended: 200x200px</p>
              </div>
            )}
          </div>
        </div>

        {/* Business Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="businessName" className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              Business Name
            </Label>
            {isEditing ? (
              <Input
                id="businessName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your Cidery Name"
              />
            ) : (
              <p className="text-sm py-2">{formData.name || "—"}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-600" />
              Email Address
            </Label>
            {isEditing ? (
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@yourcidery.com"
              />
            ) : (
              <p className="text-sm py-2">{formData.email || "—"}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-purple-600" />
              Phone Number
            </Label>
            {isEditing ? (
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            ) : (
              <p className="text-sm py-2">{formData.phone || "—"}</p>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-600" />
              Website
            </Label>
            {isEditing ? (
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://www.yourcidery.com"
              />
            ) : (
              <p className="text-sm py-2">{formData.website || "—"}</p>
            )}
          </div>

          {/* Address - Full Width */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              Business Address
            </Label>
            {isEditing ? (
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Orchard Lane, Ciderville, WA 98000"
              />
            ) : (
              <p className="text-sm py-2">{formData.address || "—"}</p>
            )}
          </div>
        </div>

        {/* Business Identification Numbers */}
        <div className="pt-4 border-t">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            Business Identification Numbers
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UBI Number */}
            <div className="space-y-2">
              <Label htmlFor="ubiNumber" className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500" />
                UBI Number
                <span className="text-xs text-gray-400">(WA State)</span>
              </Label>
              {isEditing ? (
                <Input
                  id="ubiNumber"
                  value={formData.ubiNumber}
                  onChange={(e) => setFormData({ ...formData, ubiNumber: e.target.value })}
                  placeholder="000-000-000"
                />
              ) : (
                <p className="text-sm py-2 font-mono">{formData.ubiNumber || "—"}</p>
              )}
            </div>

            {/* EIN Number */}
            <div className="space-y-2">
              <Label htmlFor="einNumber" className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500" />
                EIN Number
                <span className="text-xs text-gray-400">(Federal)</span>
              </Label>
              {isEditing ? (
                <Input
                  id="einNumber"
                  value={formData.einNumber}
                  onChange={(e) => setFormData({ ...formData, einNumber: e.target.value })}
                  placeholder="00-0000000"
                />
              ) : (
                <p className="text-sm py-2 font-mono">{formData.einNumber || "—"}</p>
              )}
            </div>

            {/* TTB Permit Number */}
            <div className="space-y-2">
              <Label htmlFor="ttbPermitNumber" className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500" />
                TTB Permit Number
              </Label>
              {isEditing ? (
                <Input
                  id="ttbPermitNumber"
                  value={formData.ttbPermitNumber}
                  onChange={(e) => setFormData({ ...formData, ttbPermitNumber: e.target.value })}
                  placeholder="CID-XX-00000"
                />
              ) : (
                <p className="text-sm py-2 font-mono">{formData.ttbPermitNumber || "—"}</p>
              )}
            </div>

            {/* State License Number */}
            <div className="space-y-2">
              <Label htmlFor="stateLicenseNumber" className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-500" />
                State License Number
              </Label>
              {isEditing ? (
                <Input
                  id="stateLicenseNumber"
                  value={formData.stateLicenseNumber}
                  onChange={(e) => setFormData({ ...formData, stateLicenseNumber: e.target.value })}
                  placeholder="L000000"
                />
              ) : (
                <p className="text-sm py-2 font-mono">{formData.stateLicenseNumber || "—"}</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemSettings() {
  const { data: currentTimezone } = trpc.settings.getTimezone.useQuery();
  const updateTimezoneMutation = trpc.settings.updateTimezone.useMutation();
  const { settings, isLoading: isLoadingSettings, refetch } = useSettings();
  const utils = trpc.useUtils();
  const { toast } = useToast();

  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Local state for form values
  const [formData, setFormData] = useState({
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    theme: settings.theme,
    defaultCurrency: settings.defaultCurrency,
    volumeUnits: settings.volumeUnits,
    volumeShowSecondary: settings.volumeShowSecondary,
    weightUnits: settings.weightUnits,
    weightShowSecondary: settings.weightShowSecondary,
    temperatureUnits: settings.temperatureUnits,
    temperatureShowSecondary: settings.temperatureShowSecondary,
    densityUnits: settings.densityUnits,
    densityShowSecondary: settings.densityShowSecondary,
    pressureUnits: settings.pressureUnits,
    pressureShowSecondary: settings.pressureShowSecondary,
    stalledBatchDays: settings.stalledBatchDays,
    longAgingDays: settings.longAgingDays,
    lowInventoryThreshold: settings.lowInventoryThreshold,
    ttbReminderDays: settings.ttbReminderDays,
    defaultTargetCO2: settings.defaultTargetCO2,
    sgDecimalPlaces: settings.sgDecimalPlaces,
    phDecimalPlaces: settings.phDecimalPlaces,
    sgTemperatureCorrectionEnabled: settings.sgTemperatureCorrectionEnabled,
    hydrometerCalibrationTempC: settings.hydrometerCalibrationTempC,
  });

  // Common US timezones
  const timezones = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
    { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  ];

  // Update mutation for organization settings
  const updateSettingsMutation = trpc.settings.updateOrganizationSettings.useMutation({
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save timezone if changed
      const timezoneToSave = selectedTimezone || currentTimezone;
      if (timezoneToSave && selectedTimezone) {
        await updateTimezoneMutation.mutateAsync({
          timezone: timezoneToSave,
        });
      }

      // Save other settings
      await updateSettingsMutation.mutateAsync({
        dateFormat: formData.dateFormat,
        timeFormat: formData.timeFormat,
        sgDecimalPlaces: formData.sgDecimalPlaces,
        phDecimalPlaces: formData.phDecimalPlaces,
        sgTemperatureCorrectionEnabled: formData.sgTemperatureCorrectionEnabled,
        hydrometerCalibrationTempC: formData.hydrometerCalibrationTempC,
      });

      utils.invalidate();
      setSelectedTimezone("");
    } finally {
      setIsSaving(false);
    }
  };

  // Update form when settings load
  React.useEffect(() => {
    if (!isLoadingSettings) {
      setFormData(prev => ({
        ...prev,
        dateFormat: settings.dateFormat,
        timeFormat: settings.timeFormat,
        theme: settings.theme,
        sgDecimalPlaces: settings.sgDecimalPlaces,
        phDecimalPlaces: settings.phDecimalPlaces,
        sgTemperatureCorrectionEnabled: settings.sgTemperatureCorrectionEnabled,
        hydrometerCalibrationTempC: settings.hydrometerCalibrationTempC,
      }));
    }
  }, [isLoadingSettings, settings]);

  const displayTimezone = selectedTimezone || currentTimezone || "America/Los_Angeles";
  const displayLabel = timezones.find((tz) => tz.value === displayTimezone)?.label || displayTimezone;

  return (
    <div className="space-y-6">
      {/* Business Profile - First Section */}
      <BusinessProfile />

      {/* Timezone Settings */}
      <Card>
        <CardHeader>
          <SettingsSectionHeader
            title="Timezone"
            description="Configure the timezone for displaying dates and times"
            icon={Clock}
            implemented={true}
          />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium">Display Timezone</h4>
              <p className="text-sm text-gray-600">
                All dates and times will be displayed in this timezone
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Current: {displayLabel}
              </p>
            </div>
            <Select
              value={selectedTimezone || currentTimezone}
              onValueChange={setSelectedTimezone}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <SettingsSectionHeader
            title="Display Preferences"
            description="Configure how dates, times, and other information are displayed"
            icon={Monitor}
            implemented={true}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Format */}
            <div className="space-y-2">
              <Label htmlFor="dateFormat" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Date Format
              </Label>
              <Select
                value={formData.dateFormat}
                onValueChange={(value) => setFormData({ ...formData, dateFormat: value as any })}
              >
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mdy">MM/DD/YYYY (US)</SelectItem>
                  <SelectItem value="dmy">DD/MM/YYYY (UK/EU)</SelectItem>
                  <SelectItem value="ymd">YYYY-MM-DD (ISO)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Example: {formData.dateFormat === "mdy" ? "12/19/2025" : formData.dateFormat === "dmy" ? "19/12/2025" : "2025-12-19"}
              </p>
            </div>

            {/* Time Format */}
            <div className="space-y-2">
              <Label htmlFor="timeFormat" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                Time Format
              </Label>
              <Select
                value={formData.timeFormat}
                onValueChange={(value) => setFormData({ ...formData, timeFormat: value as any })}
              >
                <SelectTrigger id="timeFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                  <SelectItem value="24h">24-hour (14:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme - NOT IMPLEMENTED */}
            <DisabledOverlay implemented={false}>
              <div className="space-y-2">
                <Label htmlFor="theme" className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Theme
                </Label>
                <Select value={formData.theme}>
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DisabledOverlay>

            {/* Currency - NOT IMPLEMENTED */}
            <DisabledOverlay implemented={false}>
              <div className="space-y-2">
                <Label htmlFor="currency" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Currency
                </Label>
                <Select value={formData.defaultCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DisabledOverlay>
          </div>
        </CardContent>
      </Card>

      {/* Measurement Display - IMPLEMENTED */}
      <Card>
        <CardHeader>
          <SettingsSectionHeader
            title="Measurement Display"
            description="Configure decimal places for measurements"
            icon={Gauge}
            implemented={true}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SG Decimal Places */}
            <div className="space-y-2">
              <Label htmlFor="sgDecimals" className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-purple-600" />
                Specific Gravity (SG) Decimals
              </Label>
              <Select
                value={String(formData.sgDecimalPlaces)}
                onValueChange={(value) => setFormData({ ...formData, sgDecimalPlaces: parseInt(value) })}
              >
                <SelectTrigger id="sgDecimals">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 decimals (1.05)</SelectItem>
                  <SelectItem value="3">3 decimals (1.050)</SelectItem>
                  <SelectItem value="4">4 decimals (1.0500)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Example: {(1.0523).toFixed(formData.sgDecimalPlaces)}
              </p>
            </div>

            {/* pH Decimal Places */}
            <div className="space-y-2">
              <Label htmlFor="phDecimals" className="flex items-center gap-2">
                <Beaker className="w-4 h-4 text-purple-600" />
                pH Decimals
              </Label>
              <Select
                value={String(formData.phDecimalPlaces)}
                onValueChange={(value) => setFormData({ ...formData, phDecimalPlaces: parseInt(value) })}
              >
                <SelectTrigger id="phDecimals">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 decimal (3.5)</SelectItem>
                  <SelectItem value="2">2 decimals (3.50)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Example: {(3.457).toFixed(formData.phDecimalPlaces)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Measurement Corrections - IMPLEMENTED */}
      <Card>
        <CardHeader>
          <SettingsSectionHeader
            title="Measurement Corrections"
            description="Configure automatic corrections for measurement readings"
            icon={Thermometer}
            implemented={true}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SG Temperature Correction Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <h4 className="font-medium flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-purple-600" />
                SG Temperature Correction
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Automatically correct specific gravity readings for temperature variance from calibration temperature
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Hydrometers are calibrated at a specific temperature. When the sample temperature differs,
                the density reading needs correction for accurate measurements.
              </p>
            </div>
            <Switch
              checked={formData.sgTemperatureCorrectionEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, sgTemperatureCorrectionEnabled: checked })}
            />
          </div>

          {/* Hydrometer Calibration Temperature */}
          <div className={cn(
            "space-y-2 transition-opacity",
            !formData.sgTemperatureCorrectionEnabled && "opacity-50"
          )}>
            <Label htmlFor="calibrationTemp" className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-600" />
              Hydrometer Calibration Temperature
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                value={formData.hydrometerCalibrationTempC}
                onValueChange={(value) => setFormData({ ...formData, hydrometerCalibrationTempC: value })}
                disabled={!formData.sgTemperatureCorrectionEnabled}
              >
                <SelectTrigger id="calibrationTemp">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15.56">60°F / 15.56°C (US Standard)</SelectItem>
                  <SelectItem value="20">68°F / 20°C (Lab Standard)</SelectItem>
                  <SelectItem value="15">59°F / 15°C (European)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 flex items-center">
                Check your hydrometer documentation for its calibration temperature
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Most US hydrometers are calibrated at 60°F (15.56°C). Lab-grade hydrometers often use 68°F (20°C).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Unit Preferences - NOT IMPLEMENTED */}
      <Card>
        <CardHeader>
          <SettingsSectionHeader
            title="Unit Preferences"
            description="Choose your preferred measurement units"
            icon={Ruler}
            implemented={false}
          />
        </CardHeader>
        <CardContent>
          <DisabledOverlay implemented={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Droplet className="w-4 h-4" />
                  Volume
                </Label>
                <Select value={formData.volumeUnits}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gallons">Gallons</SelectItem>
                    <SelectItem value="liters">Liters</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  Weight
                </Label>
                <Select value={formData.weightUnits}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pounds">Pounds (lb)</SelectItem>
                    <SelectItem value="kilograms">Kilograms (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Temperature
                </Label>
                <Select value={formData.temperatureUnits}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fahrenheit">Fahrenheit (F)</SelectItem>
                    <SelectItem value="celsius">Celsius (C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Density
                </Label>
                <Select value={formData.densityUnits}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sg">Specific Gravity (SG)</SelectItem>
                    <SelectItem value="brix">Brix</SelectItem>
                    <SelectItem value="plato">Plato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DisabledOverlay>
        </CardContent>
      </Card>

      {/* Alert Thresholds - NOT IMPLEMENTED */}
      <Card>
        <CardHeader>
          <SettingsSectionHeader
            title="Alert Thresholds"
            description="Configure when you receive alerts and notifications"
            icon={Bell}
            implemented={false}
          />
        </CardHeader>
        <CardContent>
          <DisabledOverlay implemented={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="stalledBatch">Stalled Batch Alert (days)</Label>
                <Input
                  id="stalledBatch"
                  type="number"
                  value={formData.stalledBatchDays}
                  readOnly
                />
                <p className="text-xs text-gray-500">Alert when a batch has no activity for this many days</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="longAging">Long Aging Alert (days)</Label>
                <Input
                  id="longAging"
                  type="number"
                  value={formData.longAgingDays}
                  readOnly
                />
                <p className="text-xs text-gray-500">Alert when a batch exceeds this aging time</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowInventory">Low Inventory Threshold</Label>
                <Input
                  id="lowInventory"
                  type="number"
                  value={formData.lowInventoryThreshold}
                  readOnly
                />
                <p className="text-xs text-gray-500">Alert when packaged inventory falls below this count</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttbReminder">TTB Report Reminder (days)</Label>
                <Input
                  id="ttbReminder"
                  type="number"
                  value={formData.ttbReminderDays}
                  readOnly
                />
                <p className="text-xs text-gray-500">Remind before TTB report due date</p>
              </div>
            </div>
          </DisabledOverlay>
        </CardContent>
      </Card>

      {/* Overhead Cost Allocation - IMPLEMENTED */}
      <OverheadSettings />

      {/* Measurement Schedules - Product-type-specific measurement schedules */}
      <MeasurementSchedulesSettings />

      {/* TTB Opening Balances - For beginning inventory tracking */}
      <TTBOpeningBalancesSettings />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || updateTimezoneMutation.isPending}
          size="lg"
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    "users" | "reference" | "settings" | "calibration" | "square"
  >("users");

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
            { key: "calibration", label: "Calibration", icon: Ruler },
            { key: "square", label: "Square Integration", icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
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
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "users" && <UserManagement />}
          {activeTab === "reference" && (
            <>
              <ReferenceValues />
              <WorkersManagement />
              <BarrelOriginTypesManagement />
            </>
          )}
          {activeTab === "settings" && <SystemSettings />}
          {activeTab === "calibration" && <CalibrationSettings />}
          {activeTab === "square" && <SquareIntegration />}
        </div>
      </main>
    </div>
  );
}
