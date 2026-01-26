"use client";

import { Navbar } from "@/components/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { History, Calculator, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AuditPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit & Compliance</h1>
          <p className="text-gray-600 mt-2">
            Track changes, reconcile inventory, and maintain compliance records
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
          {/* Change History */}
          <Link href="/audit-trail/history">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200 hover:border-slate-400 h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <History className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Change History</h3>
                      <p className="text-sm text-gray-500">
                        Complete audit trail of all database changes
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* TTB Reconciliation */}
          <Link href="/audit-trail/reconciliation">
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-blue-200 hover:border-blue-400 h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Calculator className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">TTB Reconciliation</h3>
                      <p className="text-sm text-gray-500">
                        Compare TTB balances with physical inventory
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
