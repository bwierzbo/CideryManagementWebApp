'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
  carbonationProcess: z.enum(['headspace', 'inline', 'stone']),
  targetCo2Volumes: z.number().min(0.1).max(5),
  startingTemperature: z.number().min(-5).max(25),
  pressureApplied: z.number().min(0).max(50),
  startingVolume: z.number().positive(),
  startingVolumeUnit: z.enum(['L', 'gal']),
  gasType: z.string(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CarbonateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: {
    id: string;
    name: string;
    currentVolume?: number | null;
  };
  vessel: {
    id: string;
    name: string;
    maxPressure?: string | null;
  };
  onSuccess?: () => void;
}

export function CarbonateModal({
  open,
  onOpenChange,
  batch,
  vessel,
  onSuccess,
}: CarbonateModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      carbonationProcess: 'headspace',
      targetCo2Volumes: 2.5, // Default sparkling cider
      startingTemperature: 4, // Optimal carbonation temp
      pressureApplied: 18, // Will be updated by suggestions
      startingVolume: batch.currentVolume || 100,
      startingVolumeUnit: 'L',
      gasType: 'CO2',
      notes: '',
    },
  });

  const targetCO2 = form.watch('targetCo2Volumes');
  const temperature = form.watch('startingTemperature');
  const vesselMaxPressure = vessel.maxPressure ? parseFloat(vessel.maxPressure) : undefined;

  // Get suggestions from server
  const { data: suggestions, isLoading: loadingSuggestions } =
    trpc.carbonation.calculateSuggestions.useQuery(
      {
        targetCO2Volumes: targetCO2,
        temperatureCelsius: temperature,
        currentCO2Volumes: 0, // Starting fresh carbonation
        vesselMaxPressure,
      },
      {
        enabled: open && targetCO2 > 0 && temperature >= -5 && temperature <= 25,
      }
    );

  // Auto-update pressure based on suggestions
  useEffect(() => {
    if (suggestions && !form.formState.isDirty) {
      form.setValue('pressureApplied', suggestions.requiredPressurePSI);
    }
  }, [suggestions, form]);

  const startCarbonation = trpc.carbonation.start.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
      form.reset();
    },
  });

  const onSubmit = (values: FormValues) => {
    startCarbonation.mutate({
      batchId: batch.id,
      vesselId: vessel.id,
      ...values,
    });
  };

  const getCarbonationLabel = (volumes: number): string => {
    if (volumes < 1.0) return 'Still';
    if (volumes < 2.5) return 'Pétillant (lightly sparkling)';
    return 'Sparkling';
  };

  const getCarbonationColor = (volumes: number): 'secondary' | 'default' => {
    if (volumes < 1.0) return 'secondary';
    return 'default';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carbonate Batch</DialogTitle>
          <DialogDescription>
            Configure carbonation parameters for {batch.name} in {vessel.name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Target CO2 Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Target Carbonation</CardTitle>
                <CardDescription>
                  Desired CO2 volumes for the finished cider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="targetCo2Volumes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target CO2 Volumes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="2.5"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription className="flex items-center gap-2">
                        <Badge variant={getCarbonationColor(targetCO2)}>
                          {getCarbonationLabel(targetCO2)}
                        </Badge>
                        <span className="text-xs">
                          Still: 0-1.0 | Pétillant: 1.0-2.5 | Sparkling: 2.5+
                        </span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Suggestions Section */}
            {suggestions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Calculated Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium">Required Pressure</div>
                      <div className="text-2xl font-bold">
                        {suggestions.requiredPressurePSI} PSI
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Estimated Duration</div>
                      <div className="text-2xl font-bold">
                        {suggestions.estimatedDurationHours} hrs
                      </div>
                    </div>
                  </div>

                  {!suggestions.isSafeForVessel && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Pressure Warning</AlertTitle>
                      <AlertDescription>
                        Required pressure exceeds safe limit for this vessel (max:{' '}
                        {vesselMaxPressure} PSI)
                      </AlertDescription>
                    </Alert>
                  )}

                  {!suggestions.temperatureValidation.isOptimal && suggestions.temperatureValidation.message && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Temperature Note</AlertTitle>
                      <AlertDescription>
                        {suggestions.temperatureValidation.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>💡 {suggestions.recommendations.pressure}</p>
                    <p>🌡️ {suggestions.recommendations.temperature}</p>
                    <p>⏱️ {suggestions.recommendations.duration}</p>
                    <p>🔧 {suggestions.recommendations.method}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Method Selection */}
            <FormField
              control={form.control}
              name="carbonationProcess"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carbonation Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="headspace">
                        Headspace Pressure (most common)
                      </SelectItem>
                      <SelectItem value="inline">
                        Inline CO2 Injection
                      </SelectItem>
                      <SelectItem value="stone">
                        Carbonation Stone (fastest)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How CO2 will be introduced to the cider
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Starting Volume */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startingVolume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Volume</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="100"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Current volume in vessel
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startingVolumeUnit"
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

            {/* Advanced Settings */}
            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
              </Button>

              {showAdvanced && (
                <div className="space-y-4 pl-4 border-l-2">
                  <FormField
                    control={form.control}
                    name="startingTemperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperature (°C)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.5"
                            placeholder="4"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Optimal: 0-10°C for best CO2 absorption
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pressureApplied"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Applied Pressure (PSI)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.5"
                            placeholder="18"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Pressure to apply to vessel (auto-calculated from target CO2)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gasType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gas Type</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="CO2"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Usually CO2, but can be Beer Gas 75/25, CO2/N2 mix, etc.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special considerations or observations..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Display */}
            {startCarbonation.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {startCarbonation.error.message}
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
              <Button
                type="submit"
                disabled={
                  startCarbonation.isPending ||
                  (suggestions && !suggestions.isSafeForVessel)
                }
              >
                {startCarbonation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Start Carbonation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
