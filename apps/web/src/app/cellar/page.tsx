"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/navbar";
import {
  Beaker,
  FlaskConical,
  Wine,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { KegsManagement } from "@/components/packaging/kegs/KegsManagement";
import { BatchManagementTable } from "@/components/cellar/BatchManagementTable";
import { VesselMap } from "@/components/cellar/VesselMap";

export default function CellarPage() {
  const [activeTab, setActiveTab] = useState<"vessels" | "batches" | "kegs">("vessels");

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cellar</h1>
            <p className="text-gray-600 mt-1">
              Monitor fermentation vessels, track batch progress, and record
              measurements.
            </p>
          </div>
          <Link
            href="/cellar/physical-inventory"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" />
            Physical Inventory
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: "vessels", label: "Vessel Map", icon: Beaker },
            { key: "batches", label: "Batch List", icon: FlaskConical },
            { key: "kegs", label: "Keg Tracking", icon: Wine },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === "vessels" && <VesselMap />}
          {activeTab === "batches" && <BatchManagementTable />}
          {activeTab === "kegs" && <KegsManagement />}
        </div>
      </main>
    </div>
  );
}
