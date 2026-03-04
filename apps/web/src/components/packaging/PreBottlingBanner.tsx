"use client";

import React from "react";
import { trpc } from "@/utils/trpc";

/**
 * Compact pre-bottling status banner showing filter and carbonation state.
 * Designed to sit at the top of packaging modals (bottle + keg).
 */
export function PreBottlingBanner({ batchId, open }: { batchId: string; open: boolean }) {
  const { data: carbonations } = trpc.carbonation.list.useQuery(
    { batchId, limit: 1 },
    { enabled: open && !!batchId },
  );

  const { data: history } = trpc.batch.getHistory.useQuery(
    { batchId },
    { enabled: open && !!batchId },
  );

  const carb = carbonations?.[0]?.carbonation;
  const historyData = history as any;
  const filterActivity = (historyData?.activities as any[])?.find(
    (a: any) => a.type === "filter",
  );

  const filterType = filterActivity?.details?.filterType as string | undefined;
  const isBottleConditioning = carb?.carbonationProcess === "bottle_conditioning";
  const targetCo2 = carb?.targetCo2Volumes
    ? parseFloat(String(carb.targetCo2Volumes))
    : null;
  const sugarAmount = carb?.primingSugarAmount
    ? parseFloat(String(carb.primingSugarAmount))
    : null;
  const startingVol = carb?.startingVolume
    ? parseFloat(String(carb.startingVolume))
    : null;
  const sugarGPerL =
    sugarAmount && startingVol ? sugarAmount / startingVol : null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 px-1">
      <span>
        Filter:{" "}
        {filterType ? (
          <span className="text-gray-700 font-medium">
            {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
          </span>
        ) : (
          "None"
        )}
      </span>
      <span>
        Carb:{" "}
        {carb ? (
          isBottleConditioning ? (
            <span className="text-gray-700 font-medium">
              Primed
              {sugarGPerL ? ` ${sugarGPerL.toFixed(1)} g/L` : ""}
              {targetCo2 ? ` (${targetCo2.toFixed(1)} vol)` : ""}
            </span>
          ) : (
            <span className="text-gray-700 font-medium">
              Forced
              {carb.finalCo2Volumes
                ? ` ${parseFloat(String(carb.finalCo2Volumes)).toFixed(1)} vol`
                : targetCo2
                  ? ` → ${targetCo2.toFixed(1)} vol`
                  : ""}
            </span>
          )
        ) : (
          "None"
        )}
      </span>
    </div>
  );
}
