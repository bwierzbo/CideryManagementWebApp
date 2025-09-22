"use client"

import React, { useState } from "react"
import { trpc } from "@/utils/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface AddBatchMeasurementFormProps {
  batchId: string
  onSuccess: () => void
  onCancel: () => void
}

export function AddBatchMeasurementForm({
  batchId,
  onSuccess,
  onCancel,
}: AddBatchMeasurementFormProps) {
  const [measurementDate, setMeasurementDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [specificGravity, setSpecificGravity] = useState("")
  const [ph, setPh] = useState("")
  const [totalAcidity, setTotalAcidity] = useState("")
  const [temperature, setTemperature] = useState("")
  const [volumeL, setVolumeL] = useState("")
  const [notes, setNotes] = useState("")

  const addMeasurement = trpc.batch.addMeasurement.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Measurement added successfully",
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

    if (!measurementDate) {
      toast({
        title: "Error",
        description: "Please select a measurement date",
        variant: "destructive",
      })
      return
    }

    const measurementData: any = {
      batchId,
      measurementDate: new Date(measurementDate).toISOString(),
    }

    if (specificGravity) measurementData.specificGravity = parseFloat(specificGravity)
    if (ph) measurementData.ph = parseFloat(ph)
    if (totalAcidity) measurementData.totalAcidity = parseFloat(totalAcidity)
    if (temperature) measurementData.temperature = parseFloat(temperature)
    if (volumeL) measurementData.volumeL = parseFloat(volumeL)
    if (notes) measurementData.notes = notes

    addMeasurement.mutate(measurementData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="measurementDate">Measurement Date</Label>
          <Input
            id="measurementDate"
            type="date"
            value={measurementDate}
            onChange={(e) => setMeasurementDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="specificGravity">Specific Gravity</Label>
          <Input
            id="specificGravity"
            type="number"
            step="0.001"
            placeholder="1.050"
            value={specificGravity}
            onChange={(e) => setSpecificGravity(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ph">pH</Label>
          <Input
            id="ph"
            type="number"
            step="0.01"
            placeholder="3.50"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="totalAcidity">Total Acidity (g/L)</Label>
          <Input
            id="totalAcidity"
            type="number"
            step="0.1"
            placeholder="6.5"
            value={totalAcidity}
            onChange={(e) => setTotalAcidity(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature (°C)</Label>
          <Input
            id="temperature"
            type="number"
            step="0.1"
            placeholder="20.0"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="volumeL">Volume (L)</Label>
          <Input
            id="volumeL"
            type="number"
            step="0.1"
            placeholder="1000.0"
            value={volumeL}
            onChange={(e) => setVolumeL(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any observations or comments..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={addMeasurement.isPending}>
          {addMeasurement.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Add Measurement
        </Button>
      </div>
    </form>
  )
}