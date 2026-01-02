"use client";

import { useSession } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/utils/trpc";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { useDashboardStore } from "@/stores/dashboardStore";
import { Activity, Wifi, WifiOff } from "lucide-react";

// Import widgets to register them
import "@/components/dashboard/widgets";

function PingStatus() {
  const pingQuery = trpc.ping.useQuery();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
      {pingQuery.data?.ok ? (
        <>
          <div className="relative">
            <Wifi className="w-4 h-4 text-orchard-600" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orchard-500 rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Connected
          </span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-destructive" />
          <span className="text-xs font-medium text-destructive">
            Disconnected
          </span>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const isEditing = useDashboardStore((state) => state.isEditing);
  const toggleEditMode = useDashboardStore((state) => state.toggleEditMode);
  const resetToDefault = useDashboardStore((state) => state.resetToDefault);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
                Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Overview of cidery operations and production status
              </p>
            </div>

            <div className="flex items-center gap-3">
              <PingStatus />

              {session?.user && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <Badge
                    variant={
                      (session.user as any).role === "admin"
                        ? "default"
                        : "secondary"
                    }
                    className="text-2xs"
                  >
                    {(session.user as any).role || "Unknown"}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Widget Grid */}
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <DashboardGrid />
        </div>
      </main>
    </div>
  );
}
