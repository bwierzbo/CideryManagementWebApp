"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Apple,
  Beaker,
  Droplets,
  Package,
  ArrowRight
} from "lucide-react"

interface TransactionTypeSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const transactionTypes = [
  {
    id: "apples",
    title: "Apples",
    description: "Record apple purchases from vendors",
    icon: Apple,
    route: "/purchasing",
    available: true,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100",
    borderColor: "border-green-200 hover:border-green-300"
  },
  {
    id: "additives",
    title: "Additives",
    description: "Record purchases of yeast, nutrients, etc.",
    icon: Beaker,
    route: "/inventory?tab=additives",
    available: true,
    color: "text-purple-600",
    bgColor: "bg-purple-50 hover:bg-purple-100",
    borderColor: "border-purple-200 hover:border-purple-300"
  },
  {
    id: "juice",
    title: "Juice",
    description: "Record juice purchases from external sources",
    icon: Droplets,
    route: "/juice",
    available: false,
    color: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100",
    borderColor: "border-blue-200 hover:border-blue-300"
  },
  {
    id: "packaging",
    title: "Packaging",
    description: "Record purchases of bottles, labels, caps",
    icon: Package,
    route: "/packaging",
    available: false,
    color: "text-amber-600",
    bgColor: "bg-amber-50 hover:bg-amber-100",
    borderColor: "border-amber-200 hover:border-amber-300"
  }
]

export function TransactionTypeSelector({ open, onOpenChange }: TransactionTypeSelectorProps) {
  const router = useRouter()

  const handleTypeSelect = (type: typeof transactionTypes[0]) => {
    if (type.available) {
      // Close modal and navigate to the route
      onOpenChange(false)
      if (type.id === "additives") {
        // For additives, navigate to inventory page with additives tab active
        router.push("/inventory")
        // Use a small delay to ensure page loads before setting tab
        setTimeout(() => {
          const event = new CustomEvent('setInventoryTab', { detail: 'additives' })
          window.dispatchEvent(event)
        }, 100)
      } else {
        router.push(type.route)
      }
    } else {
      // For now, just show a coming soon message
      // In the future, this could show a toast or more detailed info
      alert(`${type.title} functionality is coming soon!`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Record Transaction</DialogTitle>
          <DialogDescription>
            Choose the type of transaction you want to record
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {transactionTypes.map((type) => {
            const Icon = type.icon
            return (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all duration-200 border-2 ${
                  type.available
                    ? `${type.borderColor} hover:shadow-md`
                    : "border-gray-200 opacity-60"
                }`}
                onClick={() => handleTypeSelect(type)}
              >
                <CardContent className={`p-6 ${type.available ? type.bgColor : "bg-gray-50"}`}>
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-lg ${type.available ? "bg-white" : "bg-gray-100"}`}>
                      <Icon className={`w-6 h-6 ${type.available ? type.color : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-medium ${type.available ? "text-gray-900" : "text-gray-500"}`}>
                          {type.title}
                        </h3>
                        {type.available ? (
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">Coming Soon</span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${type.available ? "text-gray-600" : "text-gray-400"}`}>
                        {type.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}