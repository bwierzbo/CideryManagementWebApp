'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/utils/trpc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2, Clock, Target } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';

const formSchema = z.object({
  finalCo2Volumes: z.number().min(0).max(5),
  finalPressure: z.number().min(0).max(50),
  finalTemperature: z.number().min(-5).max(25),
  finalVolume: z.number().positive(),
  finalVolumeUnit: z.enum(['L', 'gal']),
  qualityCheck: z.enum(['pass', 'fail', 'needs_adjustment']),
  qualityNotes: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CompleteCarbonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carbonation: {
    id: string;
    batchId: string;
    targetCo2Volumes: number;
    startingCo2Volumes?: number | null;
    pressureApplied: number;
    startingTemperature?: number | null;
    startingVolume: number;
    startingVolumeUnit: string;
    startedAt: Date | string;
    durationHours?: number | null;
    carbonationProcess: string;
  };
  batch: {
    name: string;
  };
  vessel: {
    name: string;
  };
  onSuccess?: () => void;
}

export function CompleteCarbonationModal({
  open,
  onOpenChange,
  carbonation,
  batch,
  vessel,
  onSuccess,
}: CompleteCarbonationModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      finalCo2Volumes: carbonation.targetCo2Volumes, // Default to target
      finalPressure: carbonation.pressureApplied,
      finalTemperature: carbonation.startingTemperature || 4,
      finalVolume: carbonation.startingVolume,
      finalVolumeUnit: (carbonation.startingVolumeUnit as 'L' | 'gal') || 'L',
      qualityCheck: 'pass',
      qualityNotes: '',
      notes: '',
    },
  });

  const finalCO2 = form.watch('finalCo2Volumes');
  const qualityCheck = form.watch('qualityCheck');

  const completeCarbonation = trpc.carbonation.complete.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
      form.reset();
    },
  });

  const onSubmit = (values: FormValues) => {
    completeCarbonation.mutate({
      carbonationId: carbonation.id,
      ...values,
    });
  };

  // Calculate elapsed time
  const startTime = new Date(carbonation.startedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - startTime.getTime();
  const elapsedHours = Math.round(elapsedMs / (1000 * 60 * 60));

  // Calculate variance from target
  const variance = finalCO2 - carbonation.targetCo2Volumes;
  const variancePercent = (variance / carbonation.targetCo2Volumes) * 100;
  const isOnTarget = Math.abs(variance) < 0.3; // Within 0.3 volumes

  const getCarbonationLabel = (volumes: number): string => {
    if (volumes < 1.0) return 'Still';
    if (volumes < 2.5) return 'Pétillant';
    return 'Sparkling';
  };

  const getVarianceBadge = () => {
    if (Math.abs(variance) < 0.3) {
      return <Badge variant="default" className="bg-green-600">On Target</Badge>;
    } else if (Math.abs(variance) < 0.5) {
      return <Badge variant="secondary">Close</Badge>;
    } else if (variance > 0) {
      return <Badge variant="destructive">Over Carbonated</Badge>;
    } else {
      return <Badge variant="destructive">Under Carbonated</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Carbonation</DialogTitle>
          <DialogDescription>
            Record final measurements for {batch.name} in {vessel.name}
          </DialogDescription>
        </DialogHeader>

        {/* Carbonation Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carbonation Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Target CO2</div>
                <div className="text-xl font-semibold">
                  {carbonation.targetCo2Volumes.toFixed(2)} vol
                </div>
                <Badge variant="secondary" className="mt-1">
                  {getCarbonationLabel(carbonation.targetCo2Volumes)}
                </Badge>
              </div>

              <div>
                <div className="text-sm text-muted-foreground">Elapsed Time</div>
                <div className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {elapsedHours} hours
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Started {formatDistanceToNow(startTime, { addSuffix: true })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Method:</span>{' '}
                {carbonation.carbonationProcess.replace(/_/g, ' ')}
              </div>
              <div>
                <span className="text-muted-foreground">Pressure:</span>{' '}
                {carbonation.pressureApplied} PSI
              </div>
              <div>
                <span className="text-muted-foreground">Temp:</span>{' '}
                {carbonation.startingTemperature || 'N/A'}°C
              </div>
            </div>

            {carbonation.durationHours && (
              <div className="text-sm">
                {elapsedHours > carbonation.durationHours * 1.2 ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Carbonation is {Math.round(
                        (elapsedHours / carbonation.durationHours - 1) * 100
                      )}% over estimated duration
                    </AlertDescription>
                  </Alert>
                ) : elapsedHours >= carbonation.durationHours * 0.8 ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Estimated duration reached - ready to check
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Estimated completion in{' '}
                      {Math.round(carbonation.durationHours - elapsedHours)} hours
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Final Measurements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Final Measurements</CardTitle>
                <CardDescription>
                  Measure and record the final carbonation level
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="finalCo2Volumes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Final CO2 Volumes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder={carbonation.targetCo2Volumes.toString()}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-2 flex-wrap">
                        <Badge>{getCarbonationLabel(finalCO2)}</Badge>
                        {getVarianceBadge()}
                        {variance !== 0 && (
                          <span className="text-xs">
                            {variance > 0 ? '+' : ''}
                            {variance.toFixed(2)} vol (
                            {variancePercent > 0 ? '+' : ''}
                            {variancePercent.toFixed(1)}%)
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="finalPressure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Pressure (PSI)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.5"
                            placeholder={carbonation.pressureApplied.toString()}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="finalTemperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Temp (°C)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.5"
                            placeholder={(carbonation.startingTemperature || 4).toString()}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="finalVolume"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Volume</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder={carbonation.startingVolume.toString()}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Volume after carbonation (may have losses)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="finalVolumeUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="L">Liters (L)</SelectItem>
                            <SelectItem value="gal">Gallons (gal)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quality Check */}
            <FormField
              control={form.control}
              name="qualityCheck"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality Check Result</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pass">
                        ✅ Pass - Ready for bottling
                      </SelectItem>
                      <SelectItem value="needs_adjustment">
                        ⚠️ Needs Adjustment - Continue carbonating
                      </SelectItem>
                      <SelectItem value="fail">
                        ❌ Fail - Issues detected
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {qualityCheck === 'pass' &&
                      'Carbonation is complete and meets quality standards'}
                    {qualityCheck === 'needs_adjustment' &&
                      'Continue carbonation or adjust parameters'}
                    {qualityCheck === 'fail' &&
                      'Document issues in quality notes below'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quality Notes */}
            <FormField
              control={form.control}
              name="qualityNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quality Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Taste test results, carbonation assessment, any quality issues..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Specific notes about quality and carbonation level
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* General Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Completion Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="General observations, next steps, any other notes..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Document the final state and any observations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recommendations */}
            {!isOnTarget && (
              <Alert>
                <Target className="h-4 w-4" />
                <AlertTitle>Carbonation Variance Detected</AlertTitle>
                <AlertDescription>
                  {variance > 0
                    ? `Batch is over-carbonated by ${variance.toFixed(
                        2
                      )} volumes. Consider degassing or blending.`
                    : `Batch is under-carbonated by ${Math.abs(variance).toFixed(
                        2
                      )} volumes. Consider extending carbonation time.`}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Display */}
            {completeCarbonation.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {completeCarbonation.error.message}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={completeCarbonation.isPending}>
                {completeCarbonation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Complete Carbonation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
