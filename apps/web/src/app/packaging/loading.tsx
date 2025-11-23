import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";

/**
 * Loading component for packaging routes
 * Provides skeleton screens with progressive loading indicators
 */
export default function PackagingLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex-shrink-0">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>

        {/* Filters skeleton */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>

        {/* Table skeleton */}
        <Card>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="border-b bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-8 gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-18" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>

            {/* Table rows */}
            <div className="divide-y">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="grid grid-cols-8 gap-4 items-center">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-18" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pagination skeleton */}
        <div className="mt-6 flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        {/* Loading indicator with performance tip */}
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="bg-blue-50 border-blue-200 shadow-lg">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm text-blue-700 font-medium">
                Loading packaging data...
              </span>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

/**
 * Skeleton component for individual packaging run cards (mobile view)
 */
export function PackagingCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-18" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-18" />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton component for packaging table rows
 */
export function PackagingTableRowSkeleton() {
  return (
    <div className="px-6 py-4 animate-pulse">
      <div className="grid grid-cols-8 gap-4 items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-18" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton component for packaging filters
 */
export function PackagingFiltersSkeleton() {
  return (
    <Card className="mb-6 animate-pulse">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
