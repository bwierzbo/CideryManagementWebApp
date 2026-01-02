"use client";

import { useOrganizationSettings } from "@/contexts/SettingsContext";

interface DocumentHeaderProps {
  showLogo?: boolean;
  compact?: boolean;
}

/**
 * Reusable document header with cidery branding
 * Used in receipts, invoices, and other printable documents
 */
export function DocumentHeader({
  showLogo = true,
  compact = false,
}: DocumentHeaderProps) {
  const settings = useOrganizationSettings();

  return (
    <div className={`text-center ${compact ? "mb-4" : "mb-8"}`}>
      {/* Logo */}
      {showLogo && settings.logo && (
        <div className="mb-4">
          <img
            src={settings.logo}
            alt={settings.name}
            className="mx-auto h-16 w-auto object-contain"
          />
        </div>
      )}

      {/* Organization Name */}
      <h1
        className={`font-bold text-gray-900 ${compact ? "text-xl" : "text-2xl"}`}
      >
        {settings.name}
      </h1>

      {/* Contact Information */}
      <div
        className={`text-gray-600 ${compact ? "text-xs mt-1" : "text-sm mt-2"}`}
      >
        {settings.address && <p>{settings.address}</p>}
        <p className="flex items-center justify-center gap-3 flex-wrap">
          {settings.phone && <span>{settings.phone}</span>}
          {settings.phone && settings.website && <span>|</span>}
          {settings.website && <span>{settings.website}</span>}
        </p>
      </div>
    </div>
  );
}
