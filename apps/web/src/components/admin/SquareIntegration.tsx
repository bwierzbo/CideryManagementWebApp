"use client";

import React, { useState } from "react";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  RefreshCw,
  Package,
  Activity,
  TrendingUp,
  AlertCircle,
  Save,
  Eye,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/utils/date-format";

export function SquareIntegration() {
  const [activeTab, setActiveTab] = useState<"config" | "mapping" | "logs" | "stats">("config");

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="config">Configuration</TabsTrigger>
        <TabsTrigger value="mapping">Product Mapping</TabsTrigger>
        <TabsTrigger value="logs">Sync Logs</TabsTrigger>
        <TabsTrigger value="stats">Statistics</TabsTrigger>
      </TabsList>

      <TabsContent value="config" className="mt-6">
        <SquareConfiguration />
      </TabsContent>

      <TabsContent value="mapping" className="mt-6">
        <ProductMapping />
      </TabsContent>

      <TabsContent value="logs" className="mt-6">
        <SyncLogs />
      </TabsContent>

      <TabsContent value="stats" className="mt-6">
        <SyncStatistics />
      </TabsContent>
    </Tabs>
  );
}

function SquareConfiguration() {
  const [showToken, setShowToken] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production");
  const [webhookSignatureKey, setWebhookSignatureKey] = useState("");

  const { data: config, refetch: refetchConfig } = trpc.square.getConfig.useQuery();
  const initializeConfig = trpc.square.initializeConfig.useMutation({
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Square integration configured successfully",
      });
      refetchConfig();
      // Clear sensitive data from state
      setAccessToken("");
      setWebhookSignatureKey("");
    },
    onError: (error) => {
      toast({
        title: "Configuration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleAutoSync = trpc.square.toggleAutoSync.useMutation({
    onSuccess: (data) => {
      toast({
        title: data.enabled ? "Auto-Sync Enabled" : "Auto-Sync Disabled",
        description: data.enabled
          ? "Inventory will sync automatically"
          : "Automatic syncing paused",
      });
      refetchConfig();
    },
  });

  const handleSaveConfig = () => {
    if (!accessToken || !locationId) {
      toast({
        title: "Missing Required Fields",
        description: "Please enter both Access Token and Location ID",
        variant: "destructive",
      });
      return;
    }

    initializeConfig.mutate({
      accessToken,
      locationId,
      environment,
      webhookSignatureKey: webhookSignatureKey || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {config?.configured ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-gray-400" />
              )}
              <div>
                <p className="text-sm text-gray-600">Configuration</p>
                <p className="font-semibold">
                  {config?.configured ? "Complete" : "Not Configured"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {config?.initialized ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <XCircle className="w-8 h-8 text-gray-400" />
              )}
              <div>
                <p className="text-sm text-gray-600">API Client</p>
                <p className="font-semibold">
                  {config?.initialized ? "Initialized" : "Not Initialized"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  config?.enabled ? "bg-green-100" : "bg-gray-200"
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full ${
                    config?.enabled ? "bg-green-600" : "bg-gray-400"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-gray-600">Auto-Sync</p>
                <p className="font-semibold">
                  {config?.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
          </div>

          {config?.configured && (
            <div className="mt-4 flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Environment: <span className="font-bold">{config.environment}</span>
                </p>
                {config.locationId && (
                  <p className="text-xs text-blue-700 mt-1">
                    Location ID: {config.locationId}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAutoSync.mutate({ enabled: !config.enabled })}
              >
                {config.enabled ? "Disable Auto-Sync" : "Enable Auto-Sync"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Square API Configuration
          </CardTitle>
          <CardDescription>
            Enter your Square API credentials to enable inventory synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="accessToken">
              Access Token <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="accessToken"
                type={showToken ? "text" : "password"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your Square access token"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowToken(!showToken)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get from Square Developer Dashboard → Applications → Credentials
            </p>
          </div>

          <div>
            <Label htmlFor="locationId">
              Location ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="locationId"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Enter your Square location ID"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in Square Dashboard → Locations
            </p>
          </div>

          <div>
            <Label htmlFor="environment">Environment</Label>
            <Select
              value={environment}
              onValueChange={(v: "production" | "sandbox") => setEnvironment(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="webhookSignatureKey">
              Webhook Signature Key (Optional)
            </Label>
            <Input
              id="webhookSignatureKey"
              type="password"
              value={webhookSignatureKey}
              onChange={(e) => setWebhookSignatureKey(e.target.value)}
              placeholder="Enter webhook signature key for verification"
            />
            <p className="text-xs text-gray-500 mt-1">
              Found in Square Developer Dashboard → Webhooks → Signature Key
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              onClick={handleSaveConfig}
              disabled={initializeConfig.isPending}
            >
              {initializeConfig.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-purple-600" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Add this URL to your Square Developer Dashboard webhooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
            {typeof window !== "undefined" && window.location.origin}/api/webhooks/square
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Subscribe to event: <code className="px-2 py-1 bg-gray-100 rounded">inventory.count.updated</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductMapping() {
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const [selectedSquareVariation, setSelectedSquareVariation] = useState<string | null>(null);
  const [selectedSquareCatalogItem, setSelectedSquareCatalogItem] = useState<string | null>(null);
  const [showOnlyUnmapped, setShowOnlyUnmapped] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data: inventoryData, refetch: refetchInventory } =
    trpc.square.getInventoryMappings.useQuery({
      limit: 50,
      offset: 0,
      onlyUnmapped: showOnlyUnmapped,
    });

  const { data: categoriesData } = trpc.square.getCategories.useQuery();

  const { data: catalogData } = trpc.square.getCatalogItems.useQuery({
    categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
  });

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const mapProduct = trpc.square.mapProduct.useMutation({
    onSuccess: () => {
      toast({
        title: "Product Mapped",
        description: "Successfully mapped product to Square",
      });
      refetchInventory();
      setSelectedInventoryItem(null);
      setSelectedSquareVariation(null);
      setSelectedSquareCatalogItem(null);
    },
    onError: (error) => {
      toast({
        title: "Mapping Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMapProduct = () => {
    if (!selectedInventoryItem || !selectedSquareVariation || !selectedSquareCatalogItem) {
      toast({
        title: "Selection Required",
        description: "Please select both inventory item and Square product",
        variant: "destructive",
      });
      return;
    }

    mapProduct.mutate({
      inventoryItemId: selectedInventoryItem,
      squareCatalogItemId: selectedSquareCatalogItem,
      squareVariationId: selectedSquareVariation,
      syncEnabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Mapping</CardTitle>
              <CardDescription>
                Connect your inventory items to Square catalog products
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowOnlyUnmapped(!showOnlyUnmapped)}
            >
              {showOnlyUnmapped ? "Show All" : "Show Unmapped Only"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Mapping Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Inventory Items</CardTitle>
            <CardDescription>
              {inventoryData?.total || 0} items ({inventoryData?.items?.filter(i => !i.squareVariationId).length || 0} unmapped)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {inventoryData?.items?.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedInventoryItem(item.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedInventoryItem === item.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.productName || item.lotCode || "No Name"}</p>
                      <p className="text-sm text-gray-600">
                        {item.packageType} - {item.packageSizeML}ml
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: {item.currentQuantity || 0}
                      </p>
                    </div>
                    {item.squareVariationId ? (
                      <Badge variant="secondary">Mapped</Badge>
                    ) : (
                      <Badge variant="outline">Unmapped</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Square Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Square Catalog</CardTitle>
            <CardDescription>
              {catalogData?.items?.length || 0} products available
              {selectedCategories.length > 0 && ` (filtered by ${selectedCategories.length} categories)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Category Filter */}
            {categoriesData?.categories && categoriesData.categories.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Filter by Category:</p>
                <div className="flex flex-wrap gap-2">
                  {categoriesData.categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        selectedCategories.includes(cat.id)
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                  {selectedCategories.length > 0 && (
                    <button
                      onClick={() => setSelectedCategories([])}
                      className="px-3 py-1 text-sm rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {catalogData?.items?.map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <p className="font-medium mb-2">{item.name}</p>
                  <div className="space-y-1">
                    {item.variations.map((variation: any) => (
                      <button
                        key={variation.id}
                        onClick={() => {
                          setSelectedSquareVariation(variation.id);
                          setSelectedSquareCatalogItem(item.id);
                        }}
                        className={`w-full text-left p-2 rounded border transition-all ${
                          selectedSquareVariation === variation.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className="text-sm font-medium">{variation.name}</p>
                        {variation.sku && (
                          <p className="text-xs text-gray-600">SKU: {variation.sku}</p>
                        )}
                        <p className="text-xs text-gray-600">
                          ${variation.price.toFixed(2)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Button */}
      {selectedInventoryItem && selectedSquareVariation && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">Ready to Map</p>
                <p className="text-sm text-blue-700">
                  Click to connect selected inventory item to Square product
                </p>
              </div>
              <Button
                onClick={handleMapProduct}
                disabled={mapProduct.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {mapProduct.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Mapping...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Map Product
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SyncLogs() {
  const { data: logsData } = trpc.square.getSyncHistory.useQuery({
    limit: 50,
    offset: 0,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync History</CardTitle>
        <CardDescription>
          {logsData?.total || 0} sync events recorded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsData?.logs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {formatDate(new Date(log.createdAt))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {log.syncDirection === "to_square" ? "→ Square" : "← Square"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{log.syncType}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(log.status)}>
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {log.quantityBefore !== null && log.quantityAfter !== null ? (
                    <span>
                      {log.quantityBefore} → {log.quantityAfter}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {(!logsData?.logs || logsData.logs.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-2" />
            <p>No sync logs yet</p>
            <p className="text-sm">Logs will appear after the first sync</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SyncStatistics() {
  const { data: stats } = trpc.square.getSyncStats.useQuery();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
            <Activity className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSyncs || 0}</div>
            <p className="text-xs text-gray-600 mt-1">
              All sync operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.successRate.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {stats?.successfulSyncs || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Syncs</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.failedSyncs || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Mappings</CardTitle>
          <CardDescription>
            Inventory items connected to Square
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-semibold">Mapped Products</p>
                  <p className="text-sm text-gray-600">
                    Ready for automatic sync
                  </p>
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {stats?.mappedItems || 0}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="font-semibold">Unmapped Products</p>
                  <p className="text-sm text-gray-600">
                    Need configuration
                  </p>
                </div>
              </div>
              <div className="text-3xl font-bold text-amber-600">
                {stats?.unmappedItems || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
