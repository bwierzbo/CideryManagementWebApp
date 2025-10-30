"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollableContainer } from "@/components/ui/scrollable-container";
import {
  Plus,
  Apple,
  Tag,
  X,
  Link2,
  Beaker,
  Droplets,
  Package,
} from "lucide-react";
import { trpc } from "@/utils/trpc";

interface VendorVarietyLinkModalProps {
  vendor: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type VarietyType = "baseFruit" | "additive" | "juice" | "packaging";

interface VarietyConfig {
  type: VarietyType;
  name: string;
  pluralName: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  apiName:
    | "vendorVariety"
    | "additiveVarieties"
    | "juiceVarieties"
    | "packagingVarieties";
}

const varietyConfigs: VarietyConfig[] = [
  {
    type: "baseFruit",
    name: "Base Fruit",
    pluralName: "Base Fruit Varieties",
    icon: Apple,
    color: "green",
    description: "Apple, pear, and other fruit varieties",
    apiName: "vendorVariety",
  },
  {
    type: "additive",
    name: "Additive",
    pluralName: "Additive Varieties",
    icon: Beaker,
    color: "purple",
    description: "Enzymes, nutrients, acids, and other additives",
    apiName: "additiveVarieties",
  },
  {
    type: "juice",
    name: "Juice",
    pluralName: "Juice Varieties",
    icon: Droplets,
    color: "blue",
    description: "Concentrated juices and other juice products",
    apiName: "juiceVarieties",
  },
  {
    type: "packaging",
    name: "Packaging",
    pluralName: "Packaging Varieties",
    icon: Package,
    color: "orange",
    description: "Bottles, labels, caps, and packaging materials",
    apiName: "packagingVarieties",
  },
];

export function VendorVarietyLinkModal({
  vendor,
  open,
  onOpenChange,
}: VendorVarietyLinkModalProps) {
  const [activeTab, setActiveTab] = useState<VarietyType>("baseFruit");
  const [isAddVarietyModalOpen, setIsAddVarietyModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [linkedVarietiesForModal, setLinkedVarietiesForModal] = useState<any[]>([]);

  // TODO: Replace with actual role check from session/auth
  const isAdmin = true; // For now, assume all users are admin for testing

  const handleAddVariety = (varietyType: VarietyType, linkedVarieties: any[]) => {
    setActiveTab(varietyType);
    setLinkedVarietiesForModal(linkedVarieties);
    setIsAddVarietyModalOpen(true);
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            Variety Links for {vendor.name}
          </DialogTitle>
          <DialogDescription>
            View and manage which varieties this vendor can supply across all
            product types
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as VarietyType)}
          >
            <TabsList className="grid w-full grid-cols-4">
              {varietyConfigs.map((config) => (
                <TabsTrigger
                  key={config.type}
                  value={config.type}
                  className="flex items-center gap-2"
                >
                  <config.icon className="w-4 h-4" />
                  {config.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {varietyConfigs.map((config) => (
              <TabsContent key={config.type} value={config.type}>
                <VarietyTabContent
                  vendor={vendor}
                  config={config}
                  isAdmin={isAdmin}
                  onAddVariety={(linkedVarieties) => handleAddVariety(config.type, linkedVarieties)}
                  refreshTrigger={refreshTrigger}
                />
              </TabsContent>
            ))}
          </Tabs>

          {/* Close Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>

        {/* Add Variety Modal */}
        <Dialog
          open={isAddVarietyModalOpen}
          onOpenChange={setIsAddVarietyModalOpen}
        >
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <AddVarietyModal
              vendor={vendor}
              varietyConfig={varietyConfigs.find((c) => c.type === activeTab)!}
              isOpen={isAddVarietyModalOpen}
              onClose={() => setIsAddVarietyModalOpen(false)}
              onSuccess={() => {
                setIsAddVarietyModalOpen(false);
                // Trigger refresh of the current tab's data
                triggerRefresh();
              }}
              linkedVarieties={linkedVarietiesForModal}
            />
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function VarietyTabContent({
  vendor,
  config,
  isAdmin,
  onAddVariety,
  refreshTrigger,
}: {
  vendor: any;
  config: VarietyConfig;
  isAdmin: boolean;
  onAddVariety: (linkedVarieties: any[]) => void;
  refreshTrigger: number;
}) {
  // Get varieties based on the config type
  const getVarietiesQuery = () => {
    switch (config.type) {
      case "baseFruit":
        return trpc.vendorVariety.listForVendor.useQuery(
          { vendorId: vendor.id },
          { enabled: !!vendor.id },
        );
      case "additive":
        return trpc.additiveVarieties.getVendorLinks.useQuery(
          { vendorId: vendor.id },
          { enabled: !!vendor.id },
        );
      case "juice":
        return trpc.juiceVarieties.getVendorLinks.useQuery(
          { vendorId: vendor.id },
          { enabled: !!vendor.id },
        );
      case "packaging":
        return trpc.packagingVarieties.getVendorLinks.useQuery(
          { vendorId: vendor.id },
          { enabled: !!vendor.id },
        );
      default:
        return { data: [], refetch: () => Promise.resolve() };
    }
  };

  const { data: varietiesData, refetch: refetchVarieties } =
    getVarietiesQuery();

  // Trigger refetch when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      refetchVarieties();
    }
  }, [refreshTrigger, refetchVarieties]);

  // Get detach mutation based on config type
  const getDetachMutation = () => {
    const onSuccessHandler = async (data: any) => {
      console.log(
        "Successfully unlinked variety:",
        data.message || "Variety unlinked successfully",
      );
      // Refetch the varieties data to update the UI
      await refetchVarieties();
    };

    const onErrorHandler = (error: any) => {
      console.error("Failed to unlink variety:", error.message);
    };

    switch (config.type) {
      case "baseFruit":
        return trpc.vendorVariety.detach.useMutation({
          onSuccess: onSuccessHandler,
          onError: onErrorHandler,
        });
      case "additive":
        return trpc.additiveVarieties.unlinkVendor.useMutation({
          onSuccess: onSuccessHandler,
          onError: onErrorHandler,
        });
      case "juice":
        return trpc.juiceVarieties.unlinkVendor.useMutation({
          onSuccess: onSuccessHandler,
          onError: onErrorHandler,
        });
      case "packaging":
        return trpc.packagingVarieties.unlinkVendor.useMutation({
          onSuccess: onSuccessHandler,
          onError: onErrorHandler,
        });
      default:
        return {
          mutate: (params: { vendorId: string; varietyId: string }) => {
            console.error("Unsupported variety type for unlinking.");
          },
          isPending: false,
        };
    }
  };

  const detachVariety = getDetachMutation();

  // Get varieties array based on response structure with proper type checking
  const varieties = (() => {
    if (!varietiesData) return [];

    if (config.type === "baseFruit") {
      // For baseFruit, check if varietiesData has a 'varieties' property
      return (varietiesData as any)?.varieties || [];
    }

    // For other types, varietiesData is the array directly
    return Array.isArray(varietiesData) ? varietiesData : [];
  })();

  const handleDetachVariety = (variety: any) => {
    // For baseFruit, use the variety ID directly
    // For other types, use the varietyId from the link record
    const varietyId =
      config.type === "baseFruit" ? variety.id : variety.varietyId;

    console.log("Detaching variety:", {
      configType: config.type,
      variety,
      varietyId,
      vendorId: vendor.id,
    });

    detachVariety.mutate({
      vendorId: vendor.id,
      varietyId,
    });
  };

  const getColorClasses = (colorName: string) => {
    const colorMap = {
      green: {
        bg: "bg-green-100",
        text: "text-green-800",
        border: "border-green-200",
        accent: "bg-green-50",
        accentText: "text-green-600",
        icon: "text-green-600",
      },
      purple: {
        bg: "bg-purple-100",
        text: "text-purple-800",
        border: "border-purple-200",
        accent: "bg-purple-50",
        accentText: "text-purple-600",
        icon: "text-purple-600",
      },
      blue: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-200",
        accent: "bg-blue-50",
        accentText: "text-blue-600",
        icon: "text-blue-600",
      },
      orange: {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-200",
        accent: "bg-orange-50",
        accentText: "text-orange-600",
        icon: "text-orange-600",
      },
    };
    return colorMap[colorName as keyof typeof colorMap] || colorMap.green;
  };

  const colors = getColorClasses(config.color);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <config.icon className={`w-5 h-5 ${colors.icon}`} />
              Linked {config.pluralName} ({varieties.length})
            </CardTitle>
            <CardDescription>
              {config.description} currently linked to this vendor
            </CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => onAddVariety(varieties)}>
              <Plus className="w-4 h-4 mr-2" />
              Add {config.name}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {varieties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <config.icon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">
              No {config.pluralName.toLowerCase()} linked
            </h3>
            <p className="text-sm mb-4">
              Add the first {config.name.toLowerCase()} variety this vendor can
              supply.
            </p>
            {isAdmin && (
              <Button onClick={() => onAddVariety(varieties)}>
                <Plus className="w-4 h-4 mr-2" />
                Add {config.name}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop and Tablet view */}
            <div className="hidden sm:block">
              <ScrollableContainer maxHeight="16rem">
                <div className="flex flex-wrap gap-2 p-1">
                  {varieties.map((variety: any) => (
                    <div
                      key={variety.id || variety.varietyId}
                      className={`flex items-center gap-2 ${colors.bg} ${colors.text} px-3 py-2 rounded-full text-sm flex-shrink-0`}
                    >
                      <Tag className="w-3 h-3" />
                      <span className="font-medium">
                        {variety.name || variety.variety?.name}
                      </span>
                      {variety.notes && (
                        <span
                          className={`text-xs ${colors.accentText} ${colors.accent} px-2 py-1 rounded`}
                        >
                          {variety.notes}
                        </span>
                      )}
                      {variety.variety?.itemType && (
                        <span
                          className={`text-xs ${colors.accentText} ${colors.accent} px-2 py-1 rounded`}
                        >
                          {variety.variety.itemType}
                        </span>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-4 w-4 p-0 hover:bg-red-100 ${colors.text} hover:text-red-600`}
                          onClick={() => handleDetachVariety(variety)}
                          title="Remove variety"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollableContainer>
            </div>

            {/* Mobile view */}
            <div className="sm:hidden">
              <ScrollableContainer maxHeight="16rem">
                <div className="space-y-2 p-1">
                  {varieties.map((variety: any) => (
                    <div
                      key={variety.id || variety.varietyId}
                      className={`flex items-center justify-between ${colors.accent} ${colors.border} border px-4 py-3 rounded-lg`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Tag className={`w-4 h-4 ${colors.icon}`} />
                          <span className={`font-medium ${colors.text}`}>
                            {variety.name || variety.variety?.name}
                          </span>
                        </div>
                        {variety.notes && (
                          <p
                            className={`text-xs ${colors.accentText} mt-1 pl-6`}
                          >
                            {variety.notes}
                          </p>
                        )}
                        {variety.variety?.itemType && (
                          <p
                            className={`text-xs ${colors.accentText} mt-1 pl-6`}
                          >
                            Type: {variety.variety.itemType}
                          </p>
                        )}
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-100"
                          onClick={() => handleDetachVariety(variety)}
                          title="Remove variety"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollableContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddVarietyModal({
  vendor,
  varietyConfig,
  isOpen,
  onClose,
  onSuccess,
  linkedVarieties,
}: {
  vendor: any;
  varietyConfig: VarietyConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  linkedVarieties: any[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVarieties, setSelectedVarieties] = useState<any[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [notes, setNotes] = useState("");

  // Search varieties with debounced query based on variety type
  const getSearchQuery = () => {
    if (varietyConfig.type === "baseFruit") {
      return trpc.vendorVariety.search.useQuery(
        { q: searchQuery, limit: 10 },
        { enabled: searchQuery.length >= 2 },
      );
    } else {
      // Use type assertion to access dynamic property
      const apiRouter = (trpc as any)[varietyConfig.apiName];
      if (!apiRouter?.list) {
        return { data: null };
      }
      return apiRouter.list.useQuery(
        {
          search: searchQuery,
          limit: 10,
          offset: 0,
        },
        { enabled: searchQuery.length >= 2 },
      );
    }
  };

  const { data: searchResults } = getSearchQuery();

  // Get attach mutation based on variety type
  const getAttachMutation = () => {
    if (varietyConfig.type === "baseFruit") {
      return trpc.vendorVariety.attach.useMutation({
        onSuccess: (data) => {
          // Show success message
          console.log(
            "Successfully linked variety:",
            data.message || "Variety linked successfully",
          );
        },
        onError: (error: any) => {
          console.error("Failed to link variety:", error.message);
          alert(`Failed to link variety: ${error.message}`);
        },
      });
    } else {
      const apiRouter = (trpc as any)[varietyConfig.apiName];
      return apiRouter?.linkVendor?.useMutation({
        onSuccess: (data: any) => {
          // Show success message
          console.log(
            "Successfully linked variety:",
            data.message || "Variety linked successfully",
          );
        },
        onError: (error: any) => {
          console.error("Failed to link variety:", error.message);
          alert(`Failed to link variety: ${error.message}`);
        },
      });
    }
  };

  const attachVariety = getAttachMutation();

  // Get varieties array based on response structure and filter out already-linked varieties
  const linkedVarietyIds = linkedVarieties.map((v: any) =>
    varietyConfig.type === "baseFruit" ? v.id : v.varietyId || v.variety?.id
  );

  const allVarieties =
    varietyConfig.type === "baseFruit"
      ? searchResults?.varieties || []
      : searchResults?.varieties || [];

  const varieties = allVarieties.filter(
    (v: any) => !linkedVarietyIds.includes(v.id)
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedVarieties([]);
    setIsCreatingNew(false);
  };

  const toggleVarietySelection = (variety: any) => {
    setSelectedVarieties((prev) => {
      const isSelected = prev.some((v) => v.id === variety.id);
      if (isSelected) {
        return prev.filter((v) => v.id !== variety.id);
      } else {
        return [...prev, variety];
      }
    });
    setIsCreatingNew(false);
  };

  const canCreateNew =
    searchQuery.trim().length >= 2 &&
    varieties.length === 0 &&
    !varieties.some(
      (v: any) => v.name.toLowerCase() === searchQuery.toLowerCase(),
    );

  const handleAttach = async () => {
    let successCount = 0;
    let errorCount = 0;

    if (selectedVarieties.length > 0) {
      // Link multiple varieties
      for (const variety of selectedVarieties) {
        try {
          if (varietyConfig.type === "baseFruit") {
            await attachVariety.mutateAsync({
              vendorId: vendor.id,
              varietyNameOrId: variety.id,
            });
          } else {
            await attachVariety.mutateAsync({
              vendorId: vendor.id,
              varietyId: variety.id,
              notes: notes.trim() || undefined,
            });
          }
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to link variety ${variety.name}:`, error);
        }
      }

      // Show summary and reset state
      if (successCount > 0) {
        console.log(`Successfully linked ${successCount} varieties`);
        onSuccess();
        setSearchQuery("");
        setSelectedVarieties([]);
        setIsCreatingNew(false);
        setNotes("");
      }
      if (errorCount > 0) {
        alert(`Failed to link ${errorCount} varieties. Check console for details.`);
      }
    } else if (isCreatingNew) {
      // Create and link new variety
      if (varietyConfig.type === "baseFruit") {
        try {
          await attachVariety.mutateAsync({
            vendorId: vendor.id,
            varietyNameOrId: searchQuery.trim(),
            notes: notes.trim() || undefined,
          });
          onSuccess();
          setSearchQuery("");
          setSelectedVarieties([]);
          setIsCreatingNew(false);
          setNotes("");
        } catch (error) {
          // Error already handled by mutation
        }
      } else {
        // For non-base fruit varieties, we need to create the variety first
        // This would require additional API endpoints for creating varieties
        // For now, we'll show an error message
        console.error(
          "Creating new varieties for non-base fruit types not yet implemented",
        );
      }
    }
  };

  const colors =
    varietyConfig.color === "green"
      ? "green"
      : varietyConfig.color === "purple"
        ? "purple"
        : varietyConfig.color === "blue"
          ? "blue"
          : "orange";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <varietyConfig.icon className={`w-5 h-5 text-${colors}-600`} />
          Add {varietyConfig.name} Variety
        </DialogTitle>
        <DialogDescription>
          Search for an existing {varietyConfig.name.toLowerCase()} variety or
          create a new one for {vendor.name}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-4">
        {/* Search Input */}
        <div>
          <Label htmlFor="variety-search">{varietyConfig.name} Variety</Label>
          <Input
            id="variety-search"
            placeholder={`Search for ${varietyConfig.name.toLowerCase()} varieties...`}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-12"
          />
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="space-y-2">
            {varieties.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">
                  Select varieties to link (already-linked varieties hidden):
                </Label>
                <ScrollableContainer maxHeight="16rem">
                  <div className="space-y-1 p-1">
                    {varieties.map((variety: any) => {
                      const isSelected = selectedVarieties.some(
                        (v) => v.id === variety.id
                      );
                      return (
                        <div
                          key={variety.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? `border-${colors}-500 bg-${colors}-50`
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => toggleVarietySelection(variety)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleVarietySelection(variety)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Tag className={`w-4 h-4 text-${colors}-600`} />
                          <div className="flex-1">
                            <span className="font-medium">{variety.name}</span>
                            {variety.itemType && (
                              <span className="text-sm text-gray-500 ml-2">
                                ({variety.itemType})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollableContainer>
              </div>
            )}

            {/* Create New Option - Only for base fruit varieties */}
            {canCreateNew && varietyConfig.type === "baseFruit" && (
              <div className="space-y-1">
                <Label className="text-sm text-gray-600">Or create new:</Label>
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    isCreatingNew
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    setIsCreatingNew(true);
                    setSelectedVarieties([]);
                  }}
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">
                    Create &quot;{searchQuery}&quot; and link
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <p className="text-sm text-gray-500">
            Type at least 2 characters to search
          </p>
        )}
      </div>

      {/* Selected Count */}
      {selectedVarieties.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-900 font-medium">
            {selectedVarieties.length} {selectedVarieties.length === 1 ? "variety" : "varieties"} selected
          </p>
        </div>
      )}

      {/* Notes Field */}
      {(isCreatingNew || selectedVarieties.length > 0) && varietyConfig.type !== "baseFruit" && (
        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Add notes about ${selectedVarieties.length > 1 ? "these" : "this"} ${varietyConfig.name.toLowerCase()} ${selectedVarieties.length > 1 ? "varieties" : "variety"} for this vendor`}
            rows={3}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>

        {/* Link/Create Button */}
        {(selectedVarieties.length > 0 || isCreatingNew) && (
          <Button onClick={handleAttach} disabled={attachVariety.isPending}>
            {attachVariety.isPending
              ? "Processing..."
              : selectedVarieties.length > 0
                ? `Link ${selectedVarieties.length} ${selectedVarieties.length === 1 ? "Variety" : "Varieties"}`
                : `Create & Link "${searchQuery}"`}
          </Button>
        )}
      </div>
    </>
  );
}
