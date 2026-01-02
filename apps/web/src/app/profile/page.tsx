"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Eye,
  EyeOff,
  Save,
  Lock,
  Type,
} from "lucide-react";
import { useFontSize, getFontSizeLabel, type FontSize } from "@/hooks/useFontSize";
import { api } from "@/server/client";
import { formatDate, formatDateTime } from "@/utils/date-format";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  // Font size preference
  const { fontSize, setFontSize, isLoaded: fontSizeLoaded } = useFontSize();

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Fetch user profile
  const { data: profile, refetch } = api.user.getProfile.useQuery();

  // Set form fields when profile data loads
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = api.user.updateProfile.useMutation({
    onSuccess: async () => {
      setProfileSuccess("Profile updated successfully");
      setProfileError("");
      await refetch();
      // Update session with new data
      await update();
      setTimeout(() => setProfileSuccess(""), 3000);
    },
    onError: (error: any) => {
      setProfileError(error.message || "Failed to update profile");
      setProfileSuccess("");
    },
    onSettled: () => {
      setProfileLoading(false);
    },
  });

  // Change password mutation
  const changePasswordMutation = api.user.changePassword.useMutation({
    onSuccess: () => {
      setPasswordSuccess("Password changed successfully");
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 3000);
    },
    onError: (error: any) => {
      setPasswordError(error.message || "Failed to change password");
      setPasswordSuccess("");
    },
    onSettled: () => {
      setPasswordLoading(false);
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError("");
    setProfileSuccess("");

    const updates: any = {};
    if (name !== profile?.name) updates.name = name;
    if (email !== profile?.email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      setProfileError("No changes to save");
      setProfileLoading(false);
      return;
    }

    updateProfileMutation.mutate(updates);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    changePasswordMutation.mutate({ currentPassword, newPassword });
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

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and email address
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile && (
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    {profileError && (
                      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                        {profileError}
                      </div>
                    )}
                    {profileSuccess && (
                      <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
                        {profileSuccess}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          Full Name
                        </Label>
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="email" className="flex items-center">
                          <Mail className="h-4 w-4 mr-2" />
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1"
                          required
                        />
                      </div>

                      <div className="pt-4 space-y-3 border-t">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-600">
                            <Shield className="h-4 w-4 mr-2" />
                            Role
                          </div>
                          {getRoleBadge(profile.role)}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-gray-600">
                            <Calendar className="h-4 w-4 mr-2" />
                            Member Since
                          </div>
                          <span className="text-sm">
                            {formatDate(profile.createdAt)}
                          </span>
                        </div>

                        {profile.lastLoginAt && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-sm text-gray-600">
                              <Calendar className="h-4 w-4 mr-2" />
                              Last Login
                            </div>
                            <span className="text-sm">
                              {formatDateTime(profile.lastLoginAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={profileLoading}
                        className="flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {profileLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Display Preferences</CardTitle>
                <CardDescription>
                  Customize how the application looks and feels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Font Size Preference */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Type className="h-4 w-4 mr-2 text-muted-foreground" />
                    <Label className="text-base font-medium">Font Size</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Adjust the text size across the application
                  </p>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as FontSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`
                          flex-1 px-4 py-3 rounded-lg border-2 transition-all duration-200
                          ${fontSize === size
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }
                        `}
                      >
                        <div className="text-center">
                          <div
                            className={`font-semibold ${
                              size === "small" ? "text-sm" : size === "large" ? "text-lg" : "text-base"
                            }`}
                          >
                            {getFontSizeLabel(size)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {size === "small" ? "14px" : size === "large" ? "18px" : "16px"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Preview
                  </div>
                  <p className="text-foreground">
                    This is how text will appear throughout the application with your current font size setting.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {passwordError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
                      {passwordSuccess}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="mt-1 relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="mt-1 relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="mt-1 relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={passwordLoading}
                      className="flex items-center"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {passwordLoading ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}