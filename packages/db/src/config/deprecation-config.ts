/**
 * Database Deprecation System Configuration
 *
 * Central configuration management for the database deprecation system.
 * Provides environment-specific settings and validation.
 */

export interface DeprecationConfig {
  // System settings
  enabled: boolean;
  environment: "development" | "test" | "staging" | "production";

  // Safety settings
  requireApproval: boolean;
  minimumConfidenceScore: number;
  coolingOffDays: number;
  allowRiskyOperations: boolean;

  // Backup settings
  backup: {
    enabled: boolean;
    directory: string;
    retentionDays: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    verificationLevel: "basic" | "full" | "comprehensive";
    testRestoreEnabled: boolean;
  };

  // Monitoring settings
  monitoring: {
    enabled: boolean;
    alertOnAccess: boolean;
    trackPerformance: boolean;
    retentionDays: number;
    batchSize: number;
    aggregationInterval: number; // minutes
  };

  // Alert settings
  alerts: {
    enabled: boolean;
    channels: string[];
    throttleWindowMinutes: number;
    maxAlertsPerHour: number;
    escalationRules: Array<{
      triggerCount: number;
      timeWindowMinutes: number;
      escalateTo: "warning" | "error" | "critical";
    }>;
  };

  // Naming convention settings
  naming: {
    maxIdentifierLength: number;
    dateFormat: string;
    reasonCodes: Record<string, string>;
  };

  // Rollback settings
  rollback: {
    timeoutSeconds: number;
    validateBeforeRollback: boolean;
    createBackupBeforeRollback: boolean;
    allowPartialRollback: boolean;
    maxRetryAttempts: number;
  };

  // Performance settings
  performance: {
    maxConcurrentOperations: number;
    queryTimeout: number;
    batchSize: number;
    enableCaching: boolean;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: DeprecationConfig = {
  enabled: true,
  environment: "development",
  requireApproval: false,
  minimumConfidenceScore: 0.9,
  coolingOffDays: 30,
  allowRiskyOperations: false,

  backup: {
    enabled: true,
    directory: process.env.DB_BACKUP_DIR || "/var/backups/database",
    retentionDays: 30,
    compressionEnabled: true,
    encryptionEnabled: false,
    verificationLevel: "full",
    testRestoreEnabled: false,
  },

  monitoring: {
    enabled: true,
    alertOnAccess: true,
    trackPerformance: true,
    retentionDays: 90,
    batchSize: 100,
    aggregationInterval: 15,
  },

  alerts: {
    enabled: true,
    channels: ["console"],
    throttleWindowMinutes: 5,
    maxAlertsPerHour: 60,
    escalationRules: [
      {
        triggerCount: 5,
        timeWindowMinutes: 15,
        escalateTo: "error",
      },
      {
        triggerCount: 20,
        timeWindowMinutes: 60,
        escalateTo: "critical",
      },
    ],
  },

  naming: {
    maxIdentifierLength: 63,
    dateFormat: "YYYYMMDD",
    reasonCodes: {
      unused: "unu",
      performance: "perf",
      migration: "migr",
      refactor: "refr",
      security: "sec",
      optimization: "opt",
    },
  },

  rollback: {
    timeoutSeconds: 300,
    validateBeforeRollback: true,
    createBackupBeforeRollback: true,
    allowPartialRollback: false,
    maxRetryAttempts: 3,
  },

  performance: {
    maxConcurrentOperations: 5,
    queryTimeout: 30000,
    batchSize: 1000,
    enableCaching: true,
  },
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS: Record<string, Partial<DeprecationConfig>> = {
  development: {
    requireApproval: false,
    allowRiskyOperations: true,
    coolingOffDays: 1,
    minimumConfidenceScore: 0.8,
    backup: {
      enabled: false,
      testRestoreEnabled: false,
    },
    alerts: {
      enabled: true,
      channels: ["console"],
      throttleWindowMinutes: 1,
    },
  },

  test: {
    requireApproval: false,
    allowRiskyOperations: true,
    coolingOffDays: 0,
    minimumConfidenceScore: 0.7,
    backup: {
      enabled: false,
      testRestoreEnabled: true,
    },
    monitoring: {
      enabled: false,
      retentionDays: 1,
    },
    alerts: {
      enabled: false,
    },
  },

  staging: {
    requireApproval: true,
    allowRiskyOperations: false,
    coolingOffDays: 7,
    minimumConfidenceScore: 0.9,
    backup: {
      enabled: true,
      testRestoreEnabled: true,
      verificationLevel: "comprehensive",
    },
    monitoring: {
      enabled: true,
      retentionDays: 30,
    },
    alerts: {
      enabled: true,
      channels: ["console", "slack"],
    },
  },

  production: {
    requireApproval: true,
    allowRiskyOperations: false,
    coolingOffDays: 90,
    minimumConfidenceScore: 0.95,
    backup: {
      enabled: true,
      testRestoreEnabled: false,
      verificationLevel: "comprehensive",
      encryptionEnabled: true,
    },
    monitoring: {
      enabled: true,
      retentionDays: 365,
    },
    alerts: {
      enabled: true,
      channels: ["console", "email", "slack", "pagerduty"],
      escalationRules: [
        {
          triggerCount: 1,
          timeWindowMinutes: 5,
          escalateTo: "warning",
        },
        {
          triggerCount: 3,
          timeWindowMinutes: 10,
          escalateTo: "error",
        },
        {
          triggerCount: 5,
          timeWindowMinutes: 15,
          escalateTo: "critical",
        },
      ],
    },
  },
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: DeprecationConfig;

  constructor(environment?: string) {
    const env = environment || process.env.NODE_ENV || "development";
    this.config = this.loadConfig(env);
  }

  /**
   * Load configuration for specific environment
   */
  private loadConfig(environment: string): DeprecationConfig {
    const baseConfig = { ...DEFAULT_CONFIG };
    const envConfig = ENVIRONMENT_CONFIGS[environment] || {};

    // Deep merge configurations
    return this.deepMerge(baseConfig, envConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): DeprecationConfig {
    return { ...this.config };
  }

  /**
   * Get specific configuration section
   */
  getBackupConfig() {
    return { ...this.config.backup };
  }

  getMonitoringConfig() {
    return { ...this.config.monitoring };
  }

  getAlertConfig() {
    return { ...this.config.alerts };
  }

  getRollbackConfig() {
    return { ...this.config.rollback };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<DeprecationConfig>): void {
    this.config = this.deepMerge(this.config, updates);
    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  validateConfig(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate backup settings
    if (this.config.backup.enabled && !this.config.backup.directory) {
      errors.push(
        "Backup directory must be specified when backups are enabled",
      );
    }

    if (this.config.backup.retentionDays < 1) {
      errors.push("Backup retention days must be at least 1");
    }

    // Validate monitoring settings
    if (this.config.monitoring.retentionDays < 1) {
      errors.push("Monitoring retention days must be at least 1");
    }

    if (this.config.monitoring.batchSize < 1) {
      errors.push("Monitoring batch size must be at least 1");
    }

    // Validate safety settings
    if (
      this.config.minimumConfidenceScore < 0 ||
      this.config.minimumConfidenceScore > 1
    ) {
      errors.push("Minimum confidence score must be between 0 and 1");
    }

    if (this.config.coolingOffDays < 0) {
      errors.push("Cooling off days cannot be negative");
    }

    // Validate performance settings
    if (this.config.performance.maxConcurrentOperations < 1) {
      errors.push("Max concurrent operations must be at least 1");
    }

    if (this.config.performance.queryTimeout < 1000) {
      warnings.push("Query timeout is very low (< 1 second)");
    }

    // Environment-specific validations
    if (this.config.environment === "production") {
      if (!this.config.requireApproval) {
        warnings.push("Production environment should require approval");
      }

      if (this.config.allowRiskyOperations) {
        warnings.push(
          "Production environment should not allow risky operations",
        );
      }

      if (this.config.coolingOffDays < 30) {
        warnings.push(
          "Production environment should have at least 30 days cooling off period",
        );
      }

      if (!this.config.backup.enabled) {
        errors.push("Production environment must have backups enabled");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get configuration summary
   */
  getConfigSummary(): {
    environment: string;
    safety: {
      requireApproval: boolean;
      minimumConfidence: number;
      coolingOffDays: number;
      allowRiskyOperations: boolean;
    };
    features: {
      backup: boolean;
      monitoring: boolean;
      alerts: boolean;
    };
    performance: {
      caching: boolean;
      maxConcurrent: number;
    };
  } {
    return {
      environment: this.config.environment,
      safety: {
        requireApproval: this.config.requireApproval,
        minimumConfidence: this.config.minimumConfidenceScore,
        coolingOffDays: this.config.coolingOffDays,
        allowRiskyOperations: this.config.allowRiskyOperations,
      },
      features: {
        backup: this.config.backup.enabled,
        monitoring: this.config.monitoring.enabled,
        alerts: this.config.alerts.enabled,
      },
      performance: {
        caching: this.config.performance.enableCaching,
        maxConcurrent: this.config.performance.maxConcurrentOperations,
      },
    };
  }

  /**
   * Export configuration to JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.config = this.deepMerge(DEFAULT_CONFIG, importedConfig);

      const validation = this.validateConfig();
      if (!validation.isValid) {
        throw new Error(
          `Invalid configuration: ${validation.errors.join(", ")}`,
        );
      }
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

/**
 * Global configuration instance
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * Get global configuration manager
 */
export function getConfigManager(environment?: string): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(environment);
  }
  return globalConfigManager;
}

/**
 * Initialize configuration with custom settings
 */
export function initializeConfig(
  customConfig: Partial<DeprecationConfig>,
): ConfigManager {
  globalConfigManager = new ConfigManager();
  globalConfigManager.updateConfig(customConfig);
  return globalConfigManager;
}

/**
 * Configuration validation utility
 */
export function validateConfiguration(config: Partial<DeprecationConfig>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const tempManager = new ConfigManager();
  tempManager.updateConfig(config);
  return tempManager.validateConfig();
}

/**
 * Environment detection utility
 */
export function detectEnvironment():
  | "development"
  | "test"
  | "staging"
  | "production" {
  const env = process.env.NODE_ENV?.toLowerCase();

  if (env === "production" || env === "prod") return "production";
  if (env === "staging" || env === "stage") return "staging";
  if (env === "test") return "test";

  return "development";
}

/**
 * Configuration presets for common scenarios
 */
export const ConfigPresets = {
  /**
   * Minimal configuration for development
   */
  development: (): DeprecationConfig => ({
    ...DEFAULT_CONFIG,
    ...ENVIRONMENT_CONFIGS.development,
  }),

  /**
   * Testing configuration
   */
  testing: (): DeprecationConfig => ({
    ...DEFAULT_CONFIG,
    ...ENVIRONMENT_CONFIGS.test,
  }),

  /**
   * High-security production configuration
   */
  highSecurity: (): DeprecationConfig => ({
    ...DEFAULT_CONFIG,
    ...ENVIRONMENT_CONFIGS.production,
    requireApproval: true,
    allowRiskyOperations: false,
    minimumConfidenceScore: 0.98,
    coolingOffDays: 180,
    backup: {
      ...DEFAULT_CONFIG.backup,
      enabled: true,
      encryptionEnabled: true,
      verificationLevel: "comprehensive",
      testRestoreEnabled: true,
    },
  }),

  /**
   * Fast iteration configuration for development
   */
  fastIteration: (): DeprecationConfig => ({
    ...DEFAULT_CONFIG,
    requireApproval: false,
    allowRiskyOperations: true,
    minimumConfidenceScore: 0.5,
    coolingOffDays: 0,
    backup: {
      ...DEFAULT_CONFIG.backup,
      enabled: false,
    },
    monitoring: {
      ...DEFAULT_CONFIG.monitoring,
      retentionDays: 1,
    },
  }),
};
