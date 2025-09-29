# Codebase Cleanup Analysis

Generated: 9/28/2025, 6:47:02 PM

## 📊 Executive Summary

- **Total Issues Found**: 115
- **High Risk Items**: 18 🔴
- **Medium Risk Items**: 54 🟡
- **Low Risk Items**: 43 🟢

### Potential Cleanup Savings
- **Files**: 0
- **Dependencies**: 0
- **Assets**: 3
- **Database Entities**: 54

## 🔥 High Risk Items (Immediate Action)

### juiceLots (database)
- **Reason**: table is defined but never used
- **Recommendation**: Consider dropping table


### tankMeasurements (database)
- **Reason**: table is defined but never used
- **Recommendation**: Consider dropping table


### tankAdditives (database)
- **Reason**: table is defined but never used
- **Recommendation**: Consider dropping table


### unitEnum (database)
- **Reason**: Enum unitEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### batchStatusEnum (database)
- **Reason**: Enum batchStatusEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### vesselStatusEnum (database)
- **Reason**: Enum vesselStatusEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### vesselTypeEnum (database)
- **Reason**: Enum vesselTypeEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### vesselMaterialEnum (database)
- **Reason**: Enum vesselMaterialEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### vesselJacketedEnum (database)
- **Reason**: Enum vesselJacketedEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### transactionTypeEnum (database)
- **Reason**: Enum transactionTypeEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### cogsItemTypeEnum (database)
- **Reason**: Enum cogsItemTypeEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### userRoleEnum (database)
- **Reason**: Enum userRoleEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### pressRunStatusEnum (database)
- **Reason**: Enum pressRunStatusEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### fruitTypeEnum (database)
- **Reason**: Enum fruitTypeEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### ciderCategoryEnum (database)
- **Reason**: Enum ciderCategoryEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### intensityEnum (database)
- **Reason**: Enum intensityEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### harvestWindowEnum (database)
- **Reason**: Enum harvestWindowEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


### packagingItemTypeEnum (database)
- **Reason**: Enum packagingItemTypeEnum is defined but never used
- **Recommendation**: Review and align schema with code usage


## ⚠️ Medium Risk Items (Review Required)

- **unitEnum** (database): enum is defined but never used
- **batchStatusEnum** (database): enum is defined but never used
- **vesselStatusEnum** (database): enum is defined but never used
- **vesselTypeEnum** (database): enum is defined but never used
- **vesselMaterialEnum** (database): enum is defined but never used
- **vesselJacketedEnum** (database): enum is defined but never used
- **transactionTypeEnum** (database): enum is defined but never used
- **cogsItemTypeEnum** (database): enum is defined but never used
- **userRoleEnum** (database): enum is defined but never used
- **pressRunStatusEnum** (database): enum is defined but never used


*... and 44 more medium-risk items*

## 🔗 Circular Dependencies

No circular dependencies detected.

## 📂 Dead Code Summary

### Unused Files (0)



### Unused Dependencies (0)



## 🖼️ Asset Cleanup

- **Unused Assets**: 3
- **Large Assets**: 0
- **Potentially Unused**: 4

## 🗄️ Database Cleanup

- **Unused Entities**: 54
- **Orphaned Queries**: 3
- **Schema Drift Issues**: 54

## ⚠️ Analysis Errors
- Failed to load knip report: Error: ENOENT: no such file or directory, open '/Users/benjaminwierzbanowski/Code/epic-cleanupandcodechecks/reports/knip-report.json'
- Failed to load depcheck report: Error: ENOENT: no such file or directory, open '/Users/benjaminwierzbanowski/Code/epic-cleanupandcodechecks/reports/depcheck-report.json'
