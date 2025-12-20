"use client";

import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, RotateCcw } from "lucide-react";
import { trpc } from "@/utils/trpc";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { useDashboardStore } from "@/stores/dashboardStore";

// Import widgets to register them
import "@/components/dashboard/widgets";

function PingStatus() {
  const pingQuery = trpc.ping.useQuery();

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${pingQuery.data?.ok ? "bg-green-500" : "bg-red-500"}`}
      />
      <span className="text-sm text-gray-600">
        API: {pingQuery.data?.ok ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isEditing = useDashboardStore((state) => state.isEditing);
  const toggleEditMode = useDashboardStore((state) => state.toggleEditMode);
  const resetToDefault = useDashboardStore((state) => state.resetToDefault);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Overview of cidery operations and production status
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right space-y-2">
                <PingStatus />
                {session?.user && (
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <Badge
                      variant={
                        (session.user as any).role === "admin"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {(session.user as any).role || "Unknown"}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Edit Mode Controls - Hidden for now, can enable later */}
              {/*
              <div className="flex items-center gap-2 border-l pl-4">
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={toggleEditMode}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  {isEditing ? "Done" : "Customize"}
                </Button>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetToDefault}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
              */}
            </div>
          </div>
        </div>

        {/* Widget Grid */}
        <DashboardGrid />
      </main>
    </div>
  );
}
