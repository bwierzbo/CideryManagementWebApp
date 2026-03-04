"use client";

import React from "react";

export interface PreBottlingData {
  filterType?: string | null;
  carbonationProcess?: string | null;
  primingSugarGPerL?: number | null;
  targetCo2?: number | null;
  finalCo2?: number | null;
}

/**
 * Compact pre-bottling status banner showing filter and carbonation state.
 * Designed to sit at the top of packaging modals (bottle + keg).
 */
export function PreBottlingBanner({ data }: { data?: PreBottlingData | null }) {
  if (!data) return null;

  const { filterType, carbonationProcess, primingSugarGPerL, targetCo2, finalCo2 } = data;
  const isBottleConditioning = carbonationProcess === "bottle_conditioning";

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 px-1">
      <span>
        Filter:{" "}
        {filterType ? (
          <span className="text-gray-700 font-medium">
            {String(filterType).charAt(0).toUpperCase() + String(filterType).slice(1)}
          </span>
        ) : (
          "None"
        )}
      </span>
      <span>
        Carb:{" "}
        {carbonationProcess ? (
          isBottleConditioning ? (
            <span className="text-gray-700 font-medium">
              Primed
              {primingSugarGPerL ? ` ${primingSugarGPerL.toFixed(1)} g/L` : ""}
              {targetCo2 ? ` (${targetCo2.toFixed(1)} vol)` : ""}
            </span>
          ) : (
            <span className="text-gray-700 font-medium">
              Forced
              {finalCo2
                ? ` ${finalCo2.toFixed(1)} vol`
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
