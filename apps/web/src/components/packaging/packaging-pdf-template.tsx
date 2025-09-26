"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Download,
  Loader2,
  Settings
} from 'lucide-react'
import {
  generatePackagingRunPDF,
  type PackagingRunPDFData,
  type PDFGeneratorOptions
} from '@/lib/pdf-generator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'

interface PackagingPDFTemplateProps {
  data: PackagingRunPDFData
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  showOptionsDialog?: boolean
}

export function PackagingPDFTemplate({
  data,
  className,
  variant = 'default',
  size = 'default',
  showOptionsDialog = false
}: PackagingPDFTemplateProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [options, setOptions] = useState<PDFGeneratorOptions>({
    companyName: 'Cidery Management',
    companyAddress: '',
    includePhotos: false,
    includeQRCode: false
  })

  const handleGeneratePDF = async (customOptions?: PDFGeneratorOptions) => {
    setIsGenerating(true)
    try {
      await generatePackagingRunPDF(data, customOptions || options)
    } catch (error) {
      console.error('Error generating PDF:', error)
      // TODO: Add toast notification for error
    } finally {
      setIsGenerating(false)
      setIsDialogOpen(false)
    }
  }

  const handleQuickGenerate = () => {
    if (showOptionsDialog) {
      setIsDialogOpen(true)
    } else {
      handleGeneratePDF()
    }
  }

  if (showOptionsDialog) {
    return (
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={isGenerating}
            onClick={handleQuickGenerate}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>PDF Export Options</DialogTitle>
            <DialogDescription>
              Customize your packaging run report before generating the PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Company Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={options.companyName}
                  onChange={(e) => setOptions(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Enter company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Company Address (Optional)</Label>
                <Input
                  id="companyAddress"
                  value={options.companyAddress}
                  onChange={(e) => setOptions(prev => ({ ...prev, companyAddress: e.target.value }))}
                  placeholder="Enter company address"
                />
              </div>
            </div>

            <Separator />

            {/* Additional Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Additional Options</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includePhotos"
                  checked={options.includePhotos}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includePhotos: checked as boolean }))
                  }
                />
                <Label htmlFor="includePhotos" className="text-sm">
                  Include photos (if available)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeQRCode"
                  checked={options.includeQRCode}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeQRCode: checked as boolean }))
                  }
                />
                <Label htmlFor="includeQRCode" className="text-sm">
                  Include QR code for traceability
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleGeneratePDF(options)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Generate PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isGenerating}
      onClick={() => handleGeneratePDF()}
    >
      {isGenerating ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileText className="w-4 h-4 mr-2" />
      )}
      Export PDF
    </Button>
  )
}

// Quick export button without options
export function QuickPDFExport({
  data,
  className,
  variant = 'outline',
  size = 'sm'
}: Omit<PackagingPDFTemplateProps, 'showOptionsDialog'>) {
  return (
    <PackagingPDFTemplate
      data={data}
      className={className}
      variant={variant}
      size={size}
      showOptionsDialog={false}
    />
  )
}

// Full options PDF export
export function AdvancedPDFExport({
  data,
  className,
  variant = 'default',
  size = 'default'
}: Omit<PackagingPDFTemplateProps, 'showOptionsDialog'>) {
  return (
    <PackagingPDFTemplate
      data={data}
      className={className}
      variant={variant}
      size={size}
      showOptionsDialog={true}
    />
  )
}

// PDF options summary component
export function PDFOptionsPreview({ options }: { options: PDFGeneratorOptions }) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
      <h4 className="font-medium text-sm">PDF Report Configuration</h4>
      <div className="text-xs text-muted-foreground space-y-1">
        <div>Company: {options.companyName || 'Not specified'}</div>
        {options.companyAddress && <div>Address: {options.companyAddress}</div>}
        <div>Include Photos: {options.includePhotos ? 'Yes' : 'No'}</div>
        <div>Include QR Code: {options.includeQRCode ? 'Yes' : 'No'}</div>
      </div>
    </div>
  )
}