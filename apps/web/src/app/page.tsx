"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  ShoppingCart,
  Grape,
  Beaker,
  Package,
  ArrowRight
} from "lucide-react"

const workflowSteps = [
  {
    icon: ShoppingCart,
    title: "Purchase",
    description: "Order apples from vendors",
    color: "bg-blue-50 text-blue-600 border-blue-200"
  },
  {
    icon: Grape,
    title: "Press", 
    description: "Extract juice from apples",
    color: "bg-purple-50 text-purple-600 border-purple-200"
  },
  {
    icon: Beaker,
    title: "Ferment",
    description: "Age and develop flavors",
    color: "bg-green-50 text-green-600 border-green-200"
  },
  {
    icon: Package,
    title: "Package",
    description: "Bottle and label products",
    color: "bg-amber-50 text-amber-600 border-amber-200"
  }
]


export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/dashboard")
    }
  }, [status, session, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <Grape className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === "authenticated") {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Grape className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Welcome to <span className="text-amber-600">CideryCraft</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Your complete cidery management system. Track everything from apple purchases 
              to bottled products with ease and precision.
            </p>
            <div className="flex justify-center">
              <Button size="lg" asChild className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg px-8">
                <Link href="/auth/signin" className="flex items-center">
                  Login <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Overview Section */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Comprehensive Cidery Management</h2>
            <p className="text-lg text-gray-600">Everything you need to run your cidery efficiently</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="text-center">
                  <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4 border-2`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              )
            })}
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 mb-6">Ready to streamline your cidery operations?</p>
            <Button size="lg" asChild className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg px-8">
              <Link href="/auth/signin" className="flex items-center">
                Get Started Today <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}