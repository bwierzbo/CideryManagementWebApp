# Tool Configuration Documentation

## Overview

This document provides comprehensive configuration information for all analysis tools in the cleanup system. Each tool is configured to work optimally with the cidery management application's monorepo structure.

## Table of Contents

1. [Analysis Tool Overview](#analysis-tool-overview)
2. [Knip Configuration](#knip-configuration)
3. [Depcheck Configuration](#depcheck-configuration)
4. [Database Analysis Configuration](#database-analysis-configuration)
5. [Custom Analysis Scripts](#custom-analysis-scripts)
6. [CI Integration Configuration](#ci-integration-configuration)
7. [Configuration Management](#configuration-management)

## Analysis Tool Overview

The cleanup system uses a combination of industry-standard tools and custom scripts:

### Core Tools

| Tool | Purpose | Configuration File | Script |
|------|---------|-------------------|--------|
| knip | Dead code detection | `analysis/config/knip.json` | `pnpm analysis:dead-code` |
| ts-prune | TypeScript unused exports | Built-in | `pnpm analysis:ts-prune` |
| depcheck | Dependency analysis | `analysis/config/depcheck.json` | `pnpm analysis:deps` |
| madge | Circular dependency detection | Command-line | `pnpm analysis:circular` |

### Custom Scripts

| Script | Purpose | Configuration | Command |
|--------|---------|---------------|---------|
| asset-scanner | Asset analysis | Built-in logic | `pnpm analysis:assets` |
| db-scanner | Database schema analysis | `analysis/config/db-analysis.json` | `pnpm analysis:database` |
| bundle-analyzer | Bundle size analysis | Built-in logic | `pnpm analysis:bundle` |
| report-generator | Comprehensive reporting | Combined configs | `pnpm analysis:all` |

## Knip Configuration

### File Location
`analysis/config/knip.json`

### Purpose
Detects unused files, dependencies, and exports across the monorepo.

### Configuration Structure

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "workspaces": {
    ".": {
      "entry": ["scripts/**/*.ts", "vitest.config.ts", "playwright.config.ts"],
      "project": ["scripts/**/*.ts", "tests/**/*.ts", "**/*.config.{js,ts,mjs}", "**/*.d.ts"]
    },
    "apps/web": {
      "entry": [
        "src/app/**/{page,layout,loading,error,not-found,global-error}.{js,ts,jsx,tsx}",
        "src/app/**/{route,middleware}.{js,ts}",
        "src/pages/**/*.{js,ts,jsx,tsx}",
        "src/middleware.{js,ts}",
        "next.config.{js,mjs}",
        "playwright.config.{js,ts}",
        "vitest.config.{js,ts}"
      ],
      "project": [
        "src/**/*.{js,ts,jsx,tsx}",
        "tests/**/*.{js,ts,jsx,tsx}",
        "**/*.config.{js,ts,mjs}",
        "**/*.d.ts"
      ],
      "ignore": [".next/**", "dist/**", "build/**", "coverage/**"]
    },
    "packages/api": {
      "entry": ["src/index.ts", "src/trpc.ts", "src/routers/index.ts"],
      "project": ["src/**/*.ts"]
    },
    "packages/db": {
      "entry": ["src/index.ts", "src/schema.ts", "drizzle.config.ts"],
      "project": ["src/**/*.ts", "drizzle/**/*.sql"],
      "ignore": ["drizzle/**/*.sql"]
    },
    "packages/lib": {
      "entry": ["src/index.ts"],
      "project": ["src/**/*.ts"]
    },
    "packages/worker": {
      "entry": ["src/index.ts"],
      "project": ["src/**/*.ts"]
    }
  },
  "ignore": [
    "node_modules/**", "dist/**", "build/**", ".next/**", "coverage/**",
    "*.d.ts", "**/*.test.{js,ts,jsx,tsx}", "**/*.spec.{js,ts,jsx,tsx}",
    "tests/**/*", "analysis/reports/**"
  ],
  "ignoreBinaries": [
    "next", "tsx", "tsc", "eslint", "prettier", "vitest", "playwright"
  ],
  "ignoreDependencies": [
    "@types/*", "eslint*", "prettier*", "typescript", "vitest", "@vitest/*",
    "@playwright/test", "concurrently", "autoprefixer", "postcss", "tailwindcss*"
  ]
}
```

### Key Configuration Sections

#### Workspaces
- **Root (.)**: Repository-level configurations and scripts
- **apps/web**: Next.js application with React components
- **packages/api**: tRPC API layer
- **packages/db**: Database schema and migrations
- **packages/lib**: Shared utilities and domain logic
- **packages/worker**: Background job processing

#### Entry Points
Entry points tell knip where to start analysis. Each workspace defines:
- Application entry points (pages, routes)
- Configuration files
- Test files
- Build scripts

#### Project Files
Project files define what should be analyzed within each workspace:
- Source code files
- Test files
- Configuration files
- Type definitions

#### Ignore Patterns
Files and directories to exclude from analysis:
- Build outputs (`dist/`, `build/`, `.next/`)
- Dependencies (`node_modules/`)
- Test files (when not relevant to dead code analysis)
- Generated files and reports

### Customization Guidelines

#### Adding New Workspaces
```json
"packages/new-package": {
  "entry": ["src/index.ts"],
  "project": ["src/**/*.ts"]
}
```

#### Excluding Specific Files
```json
"ignore": [
  "existing/patterns/**",
  "new/pattern/to/ignore/**"
]
```

#### Adding Dependencies to Ignore
```json
"ignoreDependencies": [
  "existing-deps",
  "new-dependency-to-ignore"
]
```

## Depcheck Configuration

### File Location
`analysis/config/depcheck.json`

### Purpose
Identifies unused dependencies and missing dependencies across the monorepo.

### Configuration Structure

```json
{
  "ignoreBinaries": [
    "next", "tsx", "tsc", "eslint", "prettier", "vitest", "playwright", "concurrently", "pnpm"
  ],
  "skipMissing": false,
  "ignoreMatches": [
    "@types/*", "eslint*", "prettier*", "typescript", "@vitest/*", "@playwright/test",
    "autoprefixer", "postcss", "tailwindcss*", "next", "react", "react-dom"
  ],
  "ignorePatterns": [
    "node_modules", "dist", "build", ".next", "coverage", "analysis/reports"
  ],
  "parsers": {
    "*.js": "es6", "*.jsx": "jsx", "*.ts": "typescript", "*.tsx": "tsx"
  },
  "detectors": [
    "requireCallExpression", "importDeclaration", "importCallExpression", "exportDeclaration"
  ],
  "specials": ["eslint", "prettier", "jest", "vitest", "playwright", "next", "tailwindcss"]
}
```

### Key Configuration Sections

#### ignoreBinaries
Binaries that are used indirectly and should not be flagged as unused:
- Build tools (next, tsx, tsc)
- Code quality tools (eslint, prettier)
- Testing tools (vitest, playwright)
- Package managers (pnpm)

#### ignoreMatches
Dependencies that should be ignored during analysis:
- Type definitions (@types/*)
- Development tooling (eslint*, prettier*)
- Framework dependencies (react, next)
- Testing frameworks (@vitest/*, @playwright/test)

#### Parsers
File type handling for dependency detection:
- JavaScript files: ES6 parser
- TypeScript files: TypeScript parser
- React components: JSX/TSX parsers

#### Detectors
Methods for finding dependency usage:
- Import statements (ES6 imports)
- Require calls (CommonJS)
- Dynamic imports
- Re-exports

#### Specials
Special handling for framework-specific dependencies:
- Configuration files for specific tools
- Framework-specific usage patterns
- Plugin and preset dependencies

### Customization Guidelines

#### Adding New Dependencies to Ignore
```json
"ignoreMatches": [
  "existing-patterns",
  "new-framework-*",
  "specific-package-name"
]
```

#### Adding New File Types
```json
"parsers": {
  "*.vue": "vue",
  "*.svelte": "svelte"
}
```

#### Adding New Detection Methods
```json
"detectors": [
  "existing-detectors",
  "customDetectorName"
]
```

## Database Analysis Configuration

### File Location
`analysis/config/db-analysis.json`

### Purpose
Comprehensive database schema analysis including usage patterns, unused elements, and performance assessment.

### Configuration Structure

The database analysis configuration is divided into several main sections:

#### Schema Mapping
```json
"schemaMapping": {
  "enabled": true,
  "schemaPatterns": [
    "packages/db/src/schema.ts",
    "packages/db/src/schema/**/*.ts"
  ],
  "sourcePatterns": [
    "apps/web/src/**/*.{ts,tsx}",
    "packages/api/src/**/*.ts",
    "packages/lib/src/**/*.ts",
    "packages/worker/src/**/*.ts"
  ],
  "astAnalysis": {
    "includeComments": false,
    "trackTypeReferences": true,
    "analyzeImports": true,
    "detectDynamicQueries": true
  }
}
```

#### Usage Analysis
```json
"usageAnalysis": {
  "enabled": true,
  "confidenceThresholds": {
    "high": 0.8,
    "medium": 0.6,
    "low": 0.3
  },
  "queryComplexityWeights": {
    "simple": 1,
    "medium": 2,
    "complex": 3
  },
  "frequencyThresholds": {
    "frequent": 10,
    "occasional": 3,
    "rare": 1
  }
}
```

#### Unused Elements Analysis
```json
"unusedElementsAnalysis": {
  "enabled": true,
  "removalCriteria": {
    "tables": {
      "requiredConfidence": "high",
      "checkDependencies": true,
      "checkMigrations": true,
      "checkTests": true
    },
    "columns": {
      "requiredConfidence": "medium",
      "allowNullableRemoval": true,
      "checkIndexes": true,
      "checkConstraints": true
    },
    "indexes": {
      "requiredConfidence": "high",
      "checkQueryPatterns": true,
      "allowUnusedRemoval": true
    },
    "enums": {
      "requiredConfidence": "high",
      "checkColumnUsage": true
    }
  },
  "safeguards": {
    "requireBackup": true,
    "generateRollbackScripts": true,
    "validateBeforeRemoval": true
  }
}
```

#### Performance Assessment
```json
"performanceAssessment": {
  "enabled": true,
  "metrics": {
    "indexUtilization": {"excellent": 90, "good": 80, "poor": 60},
    "schemaBloat": {"excellent": 5, "good": 10, "poor": 20},
    "queryComplexity": {"excellent": 10, "good": 20, "poor": 40}
  },
  "optimizationEstimates": {
    "indexRemoval": {
      "storagePerIndex": 50000,
      "performanceImprovementPercent": 2,
      "maintenanceHoursPerMonth": 0.5
    },
    "tableRemoval": {
      "storagePerTable": 100000,
      "maintenanceHoursPerMonth": 1.0
    },
    "queryOptimization": {
      "performanceImprovementPercent": 5,
      "effortHoursPerQuery": 4
    }
  }
}
```

### Customization Guidelines

#### Adjusting Confidence Thresholds
```json
"confidenceThresholds": {
  "high": 0.9,    // More conservative
  "medium": 0.7,  // Increased from 0.6
  "low": 0.4      // Increased from 0.3
}
```

#### Adding New Schema Patterns
```json
"schemaPatterns": [
  "existing/patterns/**/*.ts",
  "new/schema/location/**/*.ts"
]
```

#### Modifying Performance Metrics
```json
"metrics": {
  "indexUtilization": {"excellent": 95, "good": 85, "poor": 70},
  "customMetric": {"excellent": 100, "good": 80, "poor": 60}
}
```

## Custom Analysis Scripts

The cleanup system includes several custom TypeScript scripts for specialized analysis:

### Asset Scanner (`analysis/scripts/asset-scanner.ts`)
**Purpose**: Analyzes assets for duplicates and unused files
**Configuration**: Built-in logic with configurable patterns
**Usage**: `pnpm analysis:assets`

Key features:
- Duplicate detection using file hashing
- Unused asset identification
- Size optimization recommendations
- Asset consolidation suggestions

### Database Scanner (`analysis/scripts/db-scanner.ts`)
**Purpose**: High-level database schema analysis
**Configuration**: Uses `db-analysis.json`
**Usage**: `pnpm analysis:database`

Key features:
- Schema structure analysis
- Basic unused element detection
- Integration with other database scripts

### Bundle Analyzer (`analysis/scripts/bundle-analyzer.ts`)
**Purpose**: Analyzes bundle size and composition
**Configuration**: Built-in logic
**Usage**: `pnpm analysis:bundle`

Key features:
- Package-level size breakdown
- Dependency tree analysis
- Size trend tracking
- Optimization recommendations

### Report Generator (`analysis/scripts/report-generator.ts`)
**Purpose**: Combines all analysis tools into comprehensive reports
**Configuration**: Coordinates all other configurations
**Usage**: `pnpm analysis:all`

Key features:
- Multi-tool coordination
- Unified reporting format
- Baseline comparison
- Trend analysis

### Database-Specific Scripts

#### Schema Mapper (`analysis/scripts/schema-mapper.ts`)
- Maps database schema to source code usage
- Tracks type references and imports
- Analyzes dynamic query patterns

#### Usage Scanner (`analysis/scripts/db-usage-scanner.ts`)
- Analyzes actual usage patterns in code
- Calculates confidence scores for usage
- Identifies query complexity and frequency

#### Unused Elements Analyzer (`analysis/scripts/unused-elements-analyzer.ts`)
- Identifies potentially unused database elements
- Applies safety criteria for removal recommendations
- Generates rollback procedures

#### Drift Analyzer (`analysis/scripts/drift-analyzer.ts`)
- Calculates technical debt scores
- Identifies schema health issues
- Tracks drift over time

#### Performance Assessor (`analysis/scripts/performance-assessor.ts`)
- Evaluates database performance characteristics
- Provides optimization recommendations
- Estimates improvement potential

## CI Integration Configuration

### GitHub Actions Workflow
The CI integration is configured in `.github/workflows/cleanup-checks.yml`

### Quality Gate Thresholds
```yaml
env:
  MAX_BUNDLE_SIZE_KB: 1000
  MAX_BUILD_TIME_SECONDS: 120
  MAX_DEAD_CODE_FILES: 5
  MAX_UNUSED_DEPS: 3
  MAX_CIRCULAR_DEPS: 0
```

### Trigger Configuration
```yaml
on:
  push:
    branches: [main, develop, 'epic/**']
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
```

### Tool Integration
Each analysis tool is integrated into the CI pipeline:

```yaml
- name: Run Dead Code Analysis
  run: pnpm analysis:dead-code --json > analysis/reports/ci/dead-code.json

- name: Run Dependency Analysis
  run: pnpm analysis:deps --json > analysis/reports/ci/deps-check.json

- name: Run Bundle Analysis
  run: pnpm analysis:bundle --json > analysis/reports/ci/bundle-analysis.json
```

## Configuration Management

### Version Control
All configuration files are version controlled and should be updated through pull requests:

```bash
# Configuration files under version control
analysis/config/knip.json
analysis/config/depcheck.json
analysis/config/db-analysis.json
.github/workflows/cleanup-checks.yml
```

### Configuration Updates

#### Process for Updating Configurations
1. **Identify Need**: Performance issues, false positives, missing analysis
2. **Test Changes**: Test configuration changes locally
3. **Validate Impact**: Ensure changes don't break existing analysis
4. **Document Changes**: Update this documentation
5. **Deploy via PR**: Submit changes through pull request process

#### Local Testing
```bash
# Test knip configuration
pnpm analysis:dead-code --config analysis/config/knip.json

# Test depcheck configuration
pnpm analysis:deps --config analysis/config/depcheck.json

# Test database analysis configuration
pnpm analysis:database
```

#### Configuration Validation
```bash
# Validate all configurations
pnpm config:validate

# Test analysis with new configuration
pnpm analysis:all --dry-run
```

### Environment-Specific Configurations

#### Development Environment
- More lenient thresholds for experimental code
- Additional debug output
- Faster analysis cycles

#### CI Environment
- Strict quality gates
- Comprehensive analysis
- Automated reporting

#### Production Monitoring
- Real-time health monitoring
- Performance regression detection
- Automated alerting

### Backup and Recovery

#### Configuration Backup
```bash
# Create configuration backup
cp -r analysis/config analysis/config.backup.$(date +%Y%m%d)

# Restore from backup
cp -r analysis/config.backup.YYYYMMDD analysis/config
```

#### Emergency Configuration Reset
```bash
# Reset to known good configuration
git checkout HEAD~1 -- analysis/config/
pnpm analysis:all --validate
```

## Tool-Specific Commands

### Analysis Commands
```bash
# Individual tool analysis
pnpm analysis:dead-code      # Knip dead code analysis
pnpm analysis:ts-prune       # TypeScript unused exports
pnpm analysis:deps           # Dependency analysis
pnpm analysis:circular       # Circular dependency detection
pnpm analysis:assets         # Asset analysis
pnpm analysis:database       # Database analysis
pnpm analysis:bundle         # Bundle size analysis

# Combined analysis
pnpm analysis:all            # All tools combined
pnpm analysis:baseline       # Create baseline report
pnpm analysis:database-full  # Complete database analysis
```

### Configuration Commands
```bash
# Configuration management
pnpm config:validate         # Validate all configurations
pnpm config:update-tools     # Update tool configurations
pnpm config:optimize-build   # Optimize build configurations
pnpm config:update-quality-gates  # Update CI quality gates
```

### Reporting Commands
```bash
# Report generation
pnpm reports:daily           # Generate daily report
pnpm reports:weekly          # Generate weekly report
pnpm reports:monthly         # Generate monthly report
pnpm reports:performance     # Generate performance report
```

## Troubleshooting Configuration Issues

### Common Issues

1. **False Positives in Dead Code Detection**
   - Update `knip.json` ignore patterns
   - Add entry points for dynamic imports
   - Configure special handling for framework files

2. **Missing Dependencies Not Detected**
   - Check `depcheck.json` parsers
   - Verify detector configuration
   - Add special handling for framework dependencies

3. **Database Analysis Errors**
   - Verify schema patterns in `db-analysis.json`
   - Check database connection
   - Validate source pattern matching

4. **CI Pipeline Failures**
   - Check quality gate thresholds
   - Verify tool installation
   - Review artifact generation

### Configuration Validation
```bash
# Validate configurations before applying
pnpm config:validate

# Test analysis with dry-run
pnpm analysis:all --dry-run --verbose

# Check specific tool configuration
pnpm analysis:dead-code --dry-run
```

### Performance Tuning
```bash
# Profile analysis performance
time pnpm analysis:all

# Optimize specific tools
pnpm analysis:dead-code --performance
pnpm analysis:database --optimize
```

## Best Practices

1. **Regular Updates**: Review and update configurations monthly
2. **Local Testing**: Test configuration changes locally before CI
3. **Documentation**: Document all configuration changes
4. **Backup**: Maintain configuration backups
5. **Validation**: Validate configurations before deployment
6. **Monitoring**: Monitor analysis performance and accuracy
7. **Optimization**: Regularly optimize for speed and accuracy
8. **Team Communication**: Communicate configuration changes to team

## Reference

### Configuration File Locations
- `analysis/config/knip.json` - Dead code detection
- `analysis/config/depcheck.json` - Dependency analysis
- `analysis/config/db-analysis.json` - Database analysis
- `.github/workflows/cleanup-checks.yml` - CI integration

### Documentation Links
- [Knip Documentation](https://knip.dev/)
- [Depcheck Documentation](https://github.com/depcheck/depcheck)
- [Madge Documentation](https://github.com/pahen/madge)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

### Support
For configuration issues or questions:
1. Check this documentation
2. Review tool-specific documentation
3. Test changes locally
4. Contact development team
5. Create issue for tracking