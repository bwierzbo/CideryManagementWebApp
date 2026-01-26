"use client";

import { Navbar } from "@/components/navbar";
import { TTBReconciliationSummary } from "@/components/admin/TTBReconciliationSummary";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReconciliationPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">TTB Reconciliation</h1>
          <p className="text-gray-600 mt-2">
            Compare TTB opening balances with physical inventory and track reconciliation periods
          </p>
        </div>
        <TTBReconciliationSummary />
      </div>
    </div>
  );
}
