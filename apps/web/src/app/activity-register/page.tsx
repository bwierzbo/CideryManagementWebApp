"use client";

import { Navbar } from "@/components/navbar";
import { ActivityRegisterTable } from "@/components/activity/ActivityRegisterTable";

export default function ActivityRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Activity Register</h1>
          <p className="text-gray-600 mt-2">
            View all system activities and transactions in one place
          </p>
        </div>
        <ActivityRegisterTable />
      </div>
    </div>
  );
}
