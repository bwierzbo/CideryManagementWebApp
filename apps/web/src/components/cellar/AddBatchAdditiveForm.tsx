"use client"

import React, { useState } from "react"
import { trpc } from "@/utils/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface AddBatchAdditiveFormProps {
  batchId: string
  onSuccess: () => void
  onCancel: () => void
}

const additiveTypes = [
  { value: "nutrient", label: "Nutrient" },
  { value: "acid", label: "Acid" },
  { value: "enzyme", label: "Enzyme" },
  { value: "fining", label: "Fining Agent" },
  { value: "sulfite", label: "Sulfite" },
  { value: "tannin", label: "Tannin" },
  { value: "yeast", label: "Yeast" },
  { value: "sugar", label: "Sugar" },
  { value: "other", label: "Other" },
]

const units = [
  { value: "g", label: "Grams (g)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "L", label: "Liters (L)" },
  { value: "ppm", label: "Parts per million (ppm)" },
  { value: "mg/L", label: "Milligrams per liter (mg/L)" },
  { value: "g/L", label: "Grams per liter (g/L)" },
  { value: "units", label: "Units" },
]

export function AddBatchAdditiveForm({
  batchId,
  onSuccess,
  onCancel,
}: AddBatchAdditiveFormProps) {
  const [additiveType, setAdditiveType] = useState("")
  const [additiveName, setAdditiveName] = useState("")
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState("")
  const [notes, setNotes] = useState("")

  const addAdditive = trpc.batch.addAdditive.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Additive recorded successfully",
      })
      onSuccess()
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!additiveType || !additiveName || !amount || !unit) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const additiveData = {
      batchId,
      additiveType,
      additiveName,
      amount: parseFloat(amount),
      unit,
      notes: notes || undefined,
    }

    addAdditive.mutate(additiveData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="additiveType">Additive Type *</Label>
          <Select value={additiveType} onValueChange={setAdditiveType}>
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {additiveTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="additiveName">Additive Name *</Label>
          <Input
            id="additiveName"
            placeholder="e.g., Fermaid K, Malic Acid, etc."
            value={additiveName}
            onChange={(e) => setAdditiveName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.001"
            placeholder="0.000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Unit *</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional information about this addition..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={addAdditive.isPending}>
          {addAdditive.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add Additive
        </Button>
      </div>
    </form>
  )
}