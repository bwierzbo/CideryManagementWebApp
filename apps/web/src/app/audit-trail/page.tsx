"use client";

import { Navbar } from "@/components/navbar";
import { AuditTrailTable } from "@/components/audit/AuditTrailTable";

export default function AuditTrailPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-gray-600 mt-2">
            Complete history of all database changes with before/after comparison
          </p>
        </div>
        <AuditTrailTable />
      </div>
    </div>
  );
}
