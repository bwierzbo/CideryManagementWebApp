# Issue #55 Analysis: Unified API Endpoint

## Overview
Create a unified tRPC endpoint `inventory.recordTransaction` that handles all four transaction types (apple, additive, juice, packaging) with type-specific validation and proper database integration using the new schema from issue #50.

## Work Streams

### Stream A: API Structure & Types
**Type:** sequential
**Agent:** general-purpose
**Files:**
- packages/api/src/types/inventory.ts (new)
- packages/api/src/routers/inventory.ts (new)

**Work:**
1. Create transaction type definitions using discriminated unions
2. Define Zod schemas for each transaction type
3. Create base inventory router structure
4. Set up type-safe input validation

### Stream B: Transaction Handlers
**Type:** sequential (depends on A)
**Agent:** general-purpose
**Files:**
- packages/api/src/routers/inventory.ts (extend)
- packages/api/src/services/inventory.ts (new)

**Work:**
1. Implement transaction handler for each material type
2. Add business logic for inventory updates
3. Ensure transaction atomicity
4. Add proper error handling

### Stream C: Integration & Testing
**Type:** sequential (depends on B)
**Agent:** general-purpose
**Files:**
- packages/api/src/routers/index.ts (update)
- tests/api/inventory.test.ts (new)

**Work:**
1. Export inventory router
2. Create comprehensive tests for all transaction types
3. Test validation and error scenarios
4. Ensure backward compatibility

## Implementation Details

### Transaction Types Structure
```typescript
type TransactionInput =
  | { materialType: 'apple'; appleData: AppleTransactionData }
  | { materialType: 'additive'; additiveData: AdditiveTransactionData }
  | { materialType: 'juice'; juiceData: JuiceTransactionData }
  | { materialType: 'packaging'; packagingData: PackagingTransactionData }
```

### API Endpoint Design
```typescript
inventory: {
  recordTransaction: protectedProcedure
    .input(transactionInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Type-specific handling based on materialType
    })
}
```

## Dependencies
- Issue #50 (Database Schema) - COMPLETED ✅
- Database migration with material_type enum and metadata field
- Updated Drizzle schema

## Coordination Points
- Stream B depends on completion of Stream A
- Stream C depends on completion of Stream B
- Must maintain compatibility with existing vendor system

## Risk Mitigation
- Use discriminated unions for type safety
- Implement comprehensive validation
- Ensure transaction atomicity with database transactions
- Test all error scenarios thoroughly