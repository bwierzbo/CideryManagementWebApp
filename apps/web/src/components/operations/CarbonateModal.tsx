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
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateCO2Volumes } from 'lib/src/utils/carbonation-calculations';

const formSchema = z.object({
  startedAt: z.date(),
  carbonationProcess: z.enum(['headspace', 'inline', 'stone']),
  targetCo2Volumes: z.number().min(0.1).max(5).optional(),
  startingTemperature: z.number().min(-5).max(25),
  pressureApplied: z.number().min(0).max(50).optional(),
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
  const [calculationMode, setCalculationMode] = useState<'co2' | 'psi'>('co2');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startedAt: new Date(),
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
  const pressure = form.watch('pressureApplied');
  const temperature = form.watch('startingTemperature');
  const startedAt = form.watch('startedAt');
  const vesselMaxPressure = vessel.maxPressure ? parseFloat(vessel.maxPressure) : undefined;

  // Get suggestions from server when in CO2 mode
  const { data: suggestions, isLoading: loadingSuggestions } =
    trpc.carbonation.calculateSuggestions.useQuery(
      {
        targetCO2Volumes: targetCO2 ?? 2.5,
        temperatureCelsius: temperature,
        currentCO2Volumes: 0, // Starting fresh carbonation
        vesselMaxPressure,
      },
      {
        enabled: open && calculationMode === 'co2' && targetCO2 != null && targetCO2 > 0 && temperature >= -5 && temperature <= 25,
      }
    );

  // Calculate CO2 from PSI when in PSI mode
  const calculatedCO2FromPSI = calculationMode === 'psi' && pressure != null && temperature >= -5 && temperature <= 25
    ? calculateCO2Volumes(pressure, temperature)
    : null;

  // Auto-update pressure based on suggestions (CO2 mode)
  useEffect(() => {
    if (calculationMode === 'co2' && suggestions && !form.formState.isDirty) {
      form.setValue('pressureApplied', suggestions.requiredPressurePSI);
    }
  }, [calculationMode, suggestions, form]);

  // Auto-update CO2 based on PSI calculation (PSI mode)
  useEffect(() => {
    if (calculationMode === 'psi' && calculatedCO2FromPSI != null) {
      form.setValue('targetCo2Volumes', calculatedCO2FromPSI);
    }
  }, [calculationMode, calculatedCO2FromPSI, form]);

  const startCarbonation = trpc.carbonation.start.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
      form.reset();
    },
  });

  const onSubmit = (values: FormValues) => {
    // Ensure both CO2 and PSI are set before submission
    const targetCo2Volumes = values.targetCo2Volumes ?? calculatedCO2FromPSI ?? 2.5;
    const pressureApplied = values.pressureApplied ?? suggestions?.requiredPressurePSI ?? 18;

    startCarbonation.mutate({
      batchId: batch.id,
      vesselId: vessel.id,
      startedAt: values.startedAt,
      carbonationProcess: values.carbonationProcess,
      targetCo2Volumes,
      pressureApplied,
      startingTemperature: values.startingTemperature,
      startingVolume: values.startingVolume,
      startingVolumeUnit: values.startingVolumeUnit,
      gasType: values.gasType,
      notes: values.notes,
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

  // Format date for datetime-local input
  const formatDatetimeLocal = (date: Date | undefined): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    try {
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch {
      return '';
    }
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
            {/* Start Date/Time */}
            <FormField
              control={form.control}
              name="startedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Start Date & Time <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={formatDatetimeLocal(startedAt)}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      className="w-full"
                    />
                  </FormControl>
                  <FormDescription>
                    When carbonation begins (can be backdated)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Calculation Mode Selector */}
            <div className="space-y-3">
              <Label>Calculation Method</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={calculationMode === 'co2' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalculationMode('co2')}
                  className="flex-1"
                >
                  Target CO2 Volumes
                </Button>
                <Button
                  type="button"
                  variant={calculationMode === 'psi' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCalculationMode('psi')}
                  className="flex-1"
                >
                  Target Pressure
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {calculationMode === 'co2'
                  ? 'Enter desired CO2 volumes → calculates required PSI'
                  : 'Enter desired pressure → calculates resulting CO2'}
              </p>
            </div>

            {/* Target CO2 Section (CO2 mode) */}
            {calculationMode === 'co2' && (
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
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription className="flex items-center gap-2">
                          <Badge variant={getCarbonationColor(targetCO2 ?? 0)}>
                            {getCarbonationLabel(targetCO2 ?? 0)}
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
            )}

            {/* Target PSI Section (PSI mode) */}
            {calculationMode === 'psi' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Target Pressure</CardTitle>
                  <CardDescription>
                    Desired pressure to apply to the vessel
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Pressure to apply to vessel
                          {vesselMaxPressure && ` (vessel max: ${vesselMaxPressure} PSI)`}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {pressure != null && pressure > (vesselMaxPressure ?? 50) && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Pressure Warning</AlertTitle>
                      <AlertDescription>
                        Pressure exceeds safe limit for this vessel (max: {vesselMaxPressure ?? 50} PSI)
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Calculated Parameters Section - CO2 Mode */}
            {calculationMode === 'co2' && suggestions && (
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

            {/* Calculated Parameters Section - PSI Mode */}
            {calculationMode === 'psi' && calculatedCO2FromPSI != null && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Calculated CO2 Levels
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">Resulting CO2 Volumes</div>
                    <div className="text-2xl font-bold">
                      {calculatedCO2FromPSI.toFixed(2)} volumes
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={getCarbonationColor(calculatedCO2FromPSI)}>
                        {getCarbonationLabel(calculatedCO2FromPSI)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        at {pressure} PSI and {temperature}°C
                      </span>
                    </div>
                  </div>

                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>💡 Apply {pressure} PSI to achieve {calculatedCO2FromPSI.toFixed(2)} volumes</p>
                    <p>🌡️ Maintain {temperature}°C</p>
                    <p>📊 Carbonation level: {getCarbonationLabel(calculatedCO2FromPSI)}</p>
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

                  {/* Only show pressure override in CO2 mode */}
                  {calculationMode === 'co2' && (
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
                              value={field.value ?? ''}
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
                  )}

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
