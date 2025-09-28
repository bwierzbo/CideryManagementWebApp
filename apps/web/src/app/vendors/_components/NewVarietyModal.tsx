"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getCiderCategoryOptions,
  getIntensityOptions,
  getHarvestWindowOptions,
  zCiderCategory,
  zIntensity,
  zHarvestWindow,
} from "lib";

const varietySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  fruitType: z.enum(["apple", "pear", "plum"]),
  ciderCategory: zCiderCategory.optional(),
  tannin: zIntensity.optional(),
  acid: zIntensity.optional(),
  sugarBrix: zIntensity.optional(),
  harvestWindow: zHarvestWindow.optional(),
  varietyNotes: z.string().max(1000).optional(),
});

type VarietyFormData = z.infer<typeof varietySchema>;

interface NewVarietyModalProps {
  onSuccess?: () => void;
}

export function NewVarietyModal({ onSuccess }: NewVarietyModalProps) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const form = useForm<VarietyFormData>({
    resolver: zodResolver(varietySchema),
    defaultValues: {
      name: "",
      fruitType: "apple",
      ciderCategory: undefined,
      tannin: undefined,
      acid: undefined,
      sugarBrix: undefined,
      harvestWindow: undefined,
      varietyNotes: "",
    },
  });

  const createVariety = trpc.fruitVariety.create.useMutation({
    onSuccess: () => {
      toast.success("Fruit variety created successfully");
      form.reset();
      setOpen(false);
      utils.fruitVariety.listAll.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create fruit variety");
    },
  });

  const onSubmit = (data: VarietyFormData) => {
    createVariety.mutate({
      name: data.name,
      ciderCategory: data.ciderCategory as
        | "sweet"
        | "bittersweet"
        | "sharp"
        | "bittersharp"
        | undefined,
      tannin: data.tannin as
        | "high"
        | "medium-high"
        | "medium"
        | "low-medium"
        | "low"
        | undefined,
      acid: data.acid as
        | "high"
        | "medium-high"
        | "medium"
        | "low-medium"
        | "low"
        | undefined,
      sugarBrix: data.sugarBrix as
        | "high"
        | "medium-high"
        | "medium"
        | "low-medium"
        | "low"
        | undefined,
      harvestWindow: data.harvestWindow,
      varietyNotes: data.varietyNotes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Variety
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Apple Variety</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Honeycrisp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fruitType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fruit Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select fruit type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="apple">🍎 Apple</SelectItem>
                      <SelectItem value="pear">🍐 Pear</SelectItem>
                      <SelectItem value="plum">🟣 Plum</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ciderCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cider Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value as string}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getCiderCategoryOptions().map((category) => (
                          <SelectItem
                            key={category.value}
                            value={category.value}
                          >
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="harvestWindow"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harvest Window</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value as string}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select window" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getHarvestWindowOptions().map((window) => (
                          <SelectItem key={window.value} value={window.value}>
                            {window.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tannin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tannin Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value as string}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getIntensityOptions().map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acid Level</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value as string}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getIntensityOptions().map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sugarBrix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sugar Level</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value as string}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getIntensityOptions().map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="varietyNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this variety..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createVariety.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createVariety.isPending}>
                {createVariety.isPending ? "Creating..." : "Create Variety"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
