# Codebase Cleanup Action Plan

Generated: 9/28/2025, 6:29:24 PM

## 🎯 Phase 1: Critical Cleanup (High Risk - Safe to Remove)


### Files to Delete (0)
```bash

```

### Dependencies to Remove (0)
```bash

```

### Assets to Delete (0)
```bash

```

## 🔍 Phase 2: Review and Validate (Medium Risk)

### Items Requiring Manual Review
1. **unitEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

2. **batchStatusEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

3. **vesselStatusEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

4. **vesselTypeEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

5. **vesselMaterialEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

6. **vesselJacketedEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

7. **transactionTypeEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

8. **cogsItemTypeEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

9. **userRoleEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

10. **pressRunStatusEnum** (database)
   - Reason: enum is defined but never used
   - Action: Safe to remove definition
   

## 🧪 Phase 3: Testing Protocol

1. **Run full test suite**: `pnpm test`
2. **Check build**: `pnpm build`
3. **Verify functionality**: `pnpm dev` and test key features
4. **Review runtime logs**: Check for missing asset/dependency errors

## 📋 Validation Checklist

- [ ] All tests passing
- [ ] Application builds successfully
- [ ] No console errors in development
- [ ] Key user flows working
- [ ] No missing asset 404s
- [ ] Database queries execute correctly

## 🔄 Automation Scripts

Create these scripts for automated cleanup:

### cleanup-dead-code.sh
```bash
#!/bin/bash
# Remove unused files identified by knip

```

### cleanup-dependencies.sh
```bash
#!/bin/bash
# Remove unused dependencies

```

### cleanup-assets.sh
```bash
#!/bin/bash
# Remove unused assets

```

## 📊 Expected Impact

- **Disk Space Saved**: ~1MB
- **Dependencies Removed**: 0
- **Build Time Improvement**: ~0s
- **Maintenance Overhead Reduced**: 54 items
