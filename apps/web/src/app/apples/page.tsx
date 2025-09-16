'use client'

import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Apple, Settings } from 'lucide-react'
import { ApplesGrid } from './_components/ApplesGrid'
import { NewVarietyModal } from './_components/NewVarietyModal'

export default function ApplesPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || 'viewer'

  // Check if user has view permissions
  const canView = userRole === 'admin' || userRole === 'operator' || userRole === 'viewer'
  const canAdd = userRole === 'admin'

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="w-5 h-5" />
                Apple Varieties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Settings className="w-8 h-8 mx-auto mb-2" />
                <p>Access denied</p>
                <p className="text-sm">You need appropriate permissions to view apple varieties</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
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
                <Apple className="w-8 h-8 text-red-600" />
                Apple Varieties
              </h1>
              <p className="text-gray-600 mt-1">
                Manage apple variety characteristics for cider production
              </p>
            </div>
            <div className="flex items-center gap-4">
              {session?.user && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Your Role</p>
                  <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
                    {userRole}
                  </Badge>
                </div>
              )}
              {canAdd && <NewVarietyModal />}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Variety Database</CardTitle>
            <CardDescription>
              Comprehensive database of apple varieties with cider characteristics.
              {userRole === 'viewer' ? ' View-only access.' : ' Click any cell to edit inline.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApplesGrid userRole={userRole} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}