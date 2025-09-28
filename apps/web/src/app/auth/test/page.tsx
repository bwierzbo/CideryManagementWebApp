"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { trpc } from "../../../utils/trpc";
import { Button } from "../../../components/ui/button";

export default function AuthTestPage() {
  const { data: session, status } = useSession();

  // Test different endpoint permissions
  const ping = trpc.ping.useQuery();
  const profile = trpc.profile.useQuery(undefined, { enabled: !!session });
  const adminInfo = trpc.adminInfo.useQuery(undefined, { enabled: !!session });
  const vendorsList = trpc.vendors.list.useQuery(undefined, {
    enabled: !!session,
  });
  const usersCreate = trpc.users.create.useMutation();
  const vendorsDelete = trpc.vendors.delete.useMutation();

  if (status === "loading") return <p>Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Authentication Test Page</h1>

      {/* Authentication Status */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Authentication Status</h2>
        {!session ? (
          <div>
            <p className="mb-4">Not signed in</p>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Test credentials:</p>
              <p className="text-sm">Admin: admin@example.com / admin123</p>
              <p className="text-sm">
                Operator: operator@example.com / operator123
              </p>
            </div>
            <Button onClick={() => signIn()} className="mt-4">
              Sign in
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-2">Signed in as {session.user?.email}</p>
            <p className="mb-2">Role: {(session.user as any)?.role}</p>
            <p className="mb-4">Name: {session.user?.name}</p>
            <Button onClick={() => signOut()}>Sign out</Button>
          </div>
        )}
      </div>

      {/* API Test Results */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">API Endpoints Test</h2>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Public Endpoint (/ping)</h3>
            <p className="text-sm text-gray-600">Should work for everyone</p>
            <p
              className={
                ping.isPending
                  ? "text-yellow-600"
                  : ping.isSuccess
                    ? "text-green-600"
                    : "text-red-600"
              }
            >
              {ping.isPending
                ? "Loading..."
                : ping.isSuccess
                  ? "✅ Success: " + JSON.stringify(ping.data)
                  : "❌ Error: " + ping.error?.message}
            </p>
          </div>

          <div>
            <h3 className="font-medium">Protected Endpoint (/profile)</h3>
            <p className="text-sm text-gray-600">Requires authentication</p>
            <p
              className={
                profile.isPending
                  ? "text-yellow-600"
                  : profile.isSuccess
                    ? "text-green-600"
                    : "text-red-600"
              }
            >
              {!session
                ? "⚪ Not attempted (not signed in)"
                : profile.isPending
                  ? "Loading..."
                  : profile.isSuccess
                    ? "✅ Success: " + JSON.stringify(profile.data)
                    : "❌ Error: " + profile.error?.message}
            </p>
          </div>

          <div>
            <h3 className="font-medium">Admin-Only Endpoint (/adminInfo)</h3>
            <p className="text-sm text-gray-600">Requires admin role</p>
            <p
              className={
                adminInfo.isPending
                  ? "text-yellow-600"
                  : adminInfo.isSuccess
                    ? "text-green-600"
                    : "text-red-600"
              }
            >
              {!session
                ? "⚪ Not attempted (not signed in)"
                : adminInfo.isPending
                  ? "Loading..."
                  : adminInfo.isSuccess
                    ? "✅ Success: " + JSON.stringify(adminInfo.data)
                    : "❌ Error: " + adminInfo.error?.message}
            </p>
          </div>

          <div>
            <h3 className="font-medium">RBAC Endpoint (/vendors.list)</h3>
            <p className="text-sm text-gray-600">
              Requires &apos;list vendor&apos; permission
            </p>
            <p
              className={
                vendorsList.isPending
                  ? "text-yellow-600"
                  : vendorsList.isSuccess
                    ? "text-green-600"
                    : "text-red-600"
              }
            >
              {!session
                ? "⚪ Not attempted (not signed in)"
                : vendorsList.isPending
                  ? "Loading..."
                  : vendorsList.isSuccess
                    ? "✅ Success: " + JSON.stringify(vendorsList.data)
                    : "❌ Error: " + vendorsList.error?.message}
            </p>
          </div>
        </div>
      </div>

      {/* Permission Test Actions */}
      {session && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">RBAC Permission Tests</h2>
          <p className="text-sm text-gray-600 mb-4">
            These mutations will test if your role has the required permissions
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Create User (Admin only)</h3>
              <Button
                onClick={() =>
                  usersCreate.mutate({ email: "test@example.com" })
                }
                disabled={usersCreate.isPending}
                className="mt-2"
              >
                {usersCreate.isPending ? "Testing..." : "Test Create User"}
              </Button>
              {usersCreate.data && (
                <p className="text-green-600 mt-2">
                  ✅ Success: {JSON.stringify(usersCreate.data)}
                </p>
              )}
              {usersCreate.error && (
                <p className="text-red-600 mt-2">
                  ❌ Error: {usersCreate.error.message}
                </p>
              )}
            </div>

            <div>
              <h3 className="font-medium">Delete Vendor (Admin only)</h3>
              <Button
                onClick={() => vendorsDelete.mutate({ id: "test-id" })}
                disabled={vendorsDelete.isPending}
                className="mt-2"
              >
                {vendorsDelete.isPending ? "Testing..." : "Test Delete Vendor"}
              </Button>
              {vendorsDelete.data && (
                <p className="text-green-600 mt-2">
                  ✅ Success: {JSON.stringify(vendorsDelete.data)}
                </p>
              )}
              {vendorsDelete.error && (
                <p className="text-red-600 mt-2">
                  ❌ Error: {vendorsDelete.error.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
