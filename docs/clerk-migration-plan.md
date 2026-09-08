# Clerk Migration Plan (Phase 1 of app alignment)

Goal: CiderPilot joins the same invite-only Clerk instance as Orchardmapping —
one login across both apps — and retires the hand-rolled NextAuth credentials
path (flagged in the deferred security review).

## Owner steps (Clerk dashboard / Vercel — cannot be automated)

1. In the Clerk dashboard for the Orchardmapping application, add the
   CiderPilot production domain as a **satellite domain** (Clerk's
   multi-domain feature is what gives a shared session across both apps).
2. Add `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (plus the
   satellite-domain vars Clerk's docs specify) to the CiderPilot Vercel
   project and `vercel env pull` locally.
3. Invite the existing CiderPilot users (from the `users` table) via the
   Clerk dashboard, and set each user's role in **publicMetadata**:
   `{ "role": "admin" | "operator" | "viewer" }`.

## Code steps (executed with the owner available for login testing)

1. `pnpm --filter web add @clerk/nextjs`; wrap the app in `ClerkProvider`;
   replace `/apps/web/middleware.ts`'s NextAuth logic with `clerkMiddleware`
   route protection (same protected-by-default posture).
2. Replace the credentials sign-in page with Clerk's `<SignIn />` catch-all.
3. `packages/api/src/trpc.ts`: build the tRPC context from Clerk's `auth()`
   instead of `getServerSession`; `role` comes from
   `sessionClaims.publicMetadata.role`. `protectedProcedure` /
   `adminProcedure` / `auditedProcedure` keep their exact semantics.
4. `users` table stays (audit_logs FK history): add `clerk_user_id` column,
   backfill by email match, and resolve the audit "changed by" through it.
5. Client hooks (`useUser`, `useIsAdmin`) reimplemented over Clerk's
   `useUser` + publicMetadata; IdleTimeoutProvider becomes redundant
   (Clerk session lifetimes are dashboard-configured) — remove after
   confirming the configured session timeout matches policy.

## Rollback

Keep the NextAuth code path behind `AUTH_PROVIDER=clerk|nextauth` env flag
for the first deploy; flip back instantly if anything misbehaves. Delete the
flag + NextAuth deps one release later.

## Post-migration cleanup

- Rotate the Neon DB password (standing item from the security review) and
  remove `NEXTAUTH_SECRET`/`ADMIN_*` vars everywhere.
- Update CLAUDE.md auth sections in this repo.
