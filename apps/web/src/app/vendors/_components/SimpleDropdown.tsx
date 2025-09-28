"use client";

import React from "react";

interface SimpleDropdownProps {
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onSave: (value: string | null) => void;
}

export function SimpleDropdown({
  value,
  options,
  onSave,
}: SimpleDropdownProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    console.log("🔷 SimpleDropdown onChange:", {
      oldValue: value,
      newValue,
      willSave: newValue !== "",
    });

    if (newValue === "__clear__") {
      console.log("🔷 Calling onSave with null");
      onSave(null);
    } else if (newValue !== "") {
      console.log("🔷 Calling onSave with:", newValue);
      onSave(newValue);
    }
  };

  return (
    <select
      className="w-full px-3 py-2 border border-input rounded-md bg-background"
      value={value || ""}
      onChange={handleChange}
      autoFocus
    >
      <option value="">Choose...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {value && <option value="__clear__">Clear</option>}
    </select>
  );
}
