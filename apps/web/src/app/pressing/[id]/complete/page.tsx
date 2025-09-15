"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { PressRunCompletion } from "@/components/pressing"

export default function PressRunCompletePage() {
  const router = useRouter()
  const params = useParams()
  const pressRunId = params.id as string

  const handleComplete = () => {
    // Navigate back to pressing home
    router.push('/pressing')
  }

  const handleCancel = () => {
    // Go back to press run details
    router.push(`/pressing/${pressRunId}`)
  }

  const handleViewJuiceLot = (vesselId: string) => {
    // Navigate to vessel/fermentation view
    window.location.href = `/fermentation/vessels/${vesselId}`
  }

  const handleStartNewRun = () => {
    // Navigate to new press run
    router.push('/pressing/new')
  }

  const handleBackToPressingHome = () => {
    // Navigate back to pressing home
    router.push('/pressing')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 pb-8">
        <PressRunCompletion
          pressRunId={pressRunId}
          onComplete={handleComplete}
          onCancel={handleCancel}
          onViewJuiceLot={handleViewJuiceLot}
          onStartNewRun={handleStartNewRun}
          onBackToPressingHome={handleBackToPressingHome}
        />
      </main>
    </div>
  )
}