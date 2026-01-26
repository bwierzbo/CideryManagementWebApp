"use client";

import { Navbar } from "@/components/navbar";
import { AuditTrailTable } from "@/components/audit/AuditTrailTable";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuditHistoryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/audit-trail">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Audit
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Change History</h1>
          <p className="text-gray-600 mt-2">
            Complete history of all database changes with before/after comparison
          </p>
        </div>
        <AuditTrailTable />
      </div>
    </div>
  );
}
