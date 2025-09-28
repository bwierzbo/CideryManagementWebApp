"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Settings,
  Apple,
  Beaker,
  Package,
  Grape,
} from "lucide-react";
import { VendorManagement } from "@/components/inventory/VendorManagement";
import { AdditiveVarietyManagement } from "@/components/inventory/AdditiveVarietyManagement";
import { JuiceVarietyManagement } from "@/components/inventory/JuiceVarietyManagement";
import { PackagingVarietyManagement } from "@/components/inventory/PackagingVarietyManagement";
import { FruitsGrid } from "./_components/FruitsGrid";
import { NewVarietyModal } from "./_components/NewVarietyModal";

export default function VendorsPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || "viewer";
  const [activeTab, setActiveTab] = useState("vendors");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Check if user has view permissions
  const canView =
    userRole === "admin" || userRole === "operator" || userRole === "viewer";
  const canAdd = userRole === "admin" || userRole === "operator";

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Vendor Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Settings className="w-8 h-8 mx-auto mb-2" />
                <p>Access denied</p>
                <p className="text-sm">
                  You need appropriate permissions to view vendor management
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building2 className="w-8 h-8 text-blue-600" />
                Vendor Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage vendors and their associated products for your cidery
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session?.user && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Your Role</p>
                  <Badge
                    variant={userRole === "admin" ? "default" : "secondary"}
                  >
                    {userRole}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger
              value="vendors"
              className="flex items-center justify-center space-x-2 py-2"
            >
              <Building2 className="w-4 h-4" />
              <span className="text-sm">Vendors</span>
            </TabsTrigger>
            <TabsTrigger
              value="base-fruit"
              className="flex items-center justify-center space-x-2 py-2"
            >
              <Apple className="w-4 h-4" />
              <span className="text-sm">Base Fruit</span>
            </TabsTrigger>
            <TabsTrigger
              value="additives"
              className="flex items-center justify-center space-x-2 py-2"
            >
              <Beaker className="w-4 h-4" />
              <span className="text-sm">Additives</span>
            </TabsTrigger>
            <TabsTrigger
              value="packaging"
              className="flex items-center justify-center space-x-2 py-2"
            >
              <Package className="w-4 h-4" />
              <span className="text-sm">Packaging</span>
            </TabsTrigger>
            <TabsTrigger
              value="juice"
              className="flex items-center justify-center space-x-2 py-2"
            >
              <Grape className="w-4 h-4" />
              <span className="text-sm">Juice</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="space-y-6">
            <VendorManagement
              preSelectedVendorId={selectedVendorId}
              onVendorSelect={(vendorId) => setSelectedVendorId(vendorId)}
            />
          </TabsContent>

          <TabsContent value="base-fruit" className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Apple className="w-5 h-5 text-red-600" />
                      Base Fruit Varieties
                    </CardTitle>
                    <CardDescription>
                      Manage fruit variety characteristics and vendor
                      associations.
                      {userRole === "viewer"
                        ? " View-only access."
                        : " Click any cell to edit inline."}
                    </CardDescription>
                  </div>
                  {canAdd && <NewVarietyModal />}
                </div>
              </CardHeader>
              <CardContent>
                <FruitsGrid userRole={userRole} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="additives" className="space-y-6">
            <AdditiveVarietyManagement />
          </TabsContent>

          <TabsContent value="packaging" className="space-y-6">
            <PackagingVarietyManagement />
          </TabsContent>

          <TabsContent value="juice" className="space-y-6">
            <JuiceVarietyManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
