# Purchase Order PDF Reports - Administrator Guide

## Overview

This guide covers the administrative configuration, maintenance, and monitoring of the Purchase Order PDF Reports system. It includes setup procedures, security configurations, performance tuning, and troubleshooting for system administrators.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Installation and Setup](#installation-and-setup)
3. [Configuration Management](#configuration-management)
4. [Template Management](#template-management)
5. [Email Service Configuration](#email-service-configuration)
6. [Performance Monitoring](#performance-monitoring)
7. [Security Configuration](#security-configuration)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance Procedures](#maintenance-procedures)

## System Architecture

### Core Components

**PDF Generation Service** (`packages/api/src/services/pdf/`)
- `PdfGenerationService.ts`: Core PDF creation engine using PDFKit
- `TemplateEngine.ts`: Template processing and rendering
- `templates/`: PDF template configurations and layouts
- `components/`: Reusable PDF components (headers, tables, footers)

**Email Service** (`packages/api/src/services/email/`)
- `VendorEmailService.ts`: Email delivery and tracking
- `templates/`: HTML and text email templates
- `EmailQueue.ts`: Background job processing for email delivery

**Background Job System** (`packages/worker/`)
- Report generation queue management
- Email delivery processing
- File cleanup and maintenance
- Performance monitoring and alerts

**File Storage System**
- Temporary PDF storage with TTL management
- Asset storage for fonts, images, and branding
- Cache management for frequently accessed reports
- Automatic cleanup and archival

### Data Flow

```
User Request → tRPC Router → PDF Service → Template Engine → File Storage
                     ↓
Email Service → Queue System → Delivery → Audit Logging
```

### Dependencies

- **PDFKit**: PDF generation library
- **Nodemailer**: Email sending service
- **Bull Queue**: Background job processing
- **Redis**: Queue and cache storage
- **PostgreSQL**: Audit and tracking data

## Installation and Setup

### Prerequisites

```bash
# Required services
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- SMTP email service (SendGrid, AWS SES, or similar)
```

### Environment Variables

```bash
# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM_NAME="Cidery Management"
SMTP_FROM_EMAIL=noreply@yourdomain.com

# PDF Generation
PDF_FONT_PATH=/app/assets/fonts
PDF_IMAGE_PATH=/app/assets/images
PDF_TEMP_PATH=/app/temp/pdfs
PDF_MAX_FILE_SIZE=52428800  # 50MB
PDF_COMPRESSION_LEVEL=6

# File Storage
FILE_STORAGE_TTL=86400  # 24 hours
FILE_CLEANUP_INTERVAL=3600  # 1 hour
FILE_MAX_CACHE_SIZE=1073741824  # 1GB

# Background Jobs
REDIS_URL=redis://localhost:6379
JOB_CONCURRENCY=5
JOB_RETRY_ATTEMPTS=3
JOB_RETRY_DELAY=30000  # 30 seconds

# Security
PDF_ENCRYPTION_ENABLED=true
AUDIT_LOGGING_ENABLED=true
RATE_LIMIT_PER_MINUTE=100
```

### Installation Steps

1. **Install Dependencies**
```bash
pnpm install
```

2. **Run Database Migrations**
```bash
pnpm db:migrate
```

3. **Initialize Redis**
```bash
# Start Redis service
redis-server

# Verify connection
redis-cli ping
```

4. **Configure SMTP Service**
```bash
# Test email configuration
pnpm --filter api run test:email
```

5. **Set Up File Storage**
```bash
# Create required directories
mkdir -p assets/fonts assets/images temp/pdfs

# Set permissions
chmod 755 assets temp
chmod 644 assets/fonts/* assets/images/*
```

6. **Start Services**
```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

## Configuration Management

### PDF Generation Settings

**File**: `packages/api/src/services/pdf/config.ts`

```typescript
export const pdfConfig = {
  // Page settings
  pageSize: 'letter', // 'letter', 'a4', 'legal'
  margins: {
    top: 72,    // 1 inch
    bottom: 72,
    left: 72,
    right: 72
  },

  // Font configuration
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    title: 'Helvetica-Bold'
  },

  // Branding
  branding: {
    logoPath: '/assets/images/logo.png',
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    accentColor: '#f59e0b'
  },

  // Performance
  compression: true,
  streamingThreshold: 1048576, // 1MB
  maxConcurrentGenerations: 5
}
```

### Email Template Configuration

**File**: `packages/api/src/services/email/config.ts`

```typescript
export const emailConfig = {
  // SMTP settings
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },

  // Default settings
  defaults: {
    from: {
      name: process.env.SMTP_FROM_NAME || 'Cidery Management',
      address: process.env.SMTP_FROM_EMAIL
    },
    replyTo: process.env.SMTP_REPLY_TO,
    priority: 'normal' // 'high', 'normal', 'low'
  },

  // Rate limiting
  rateLimits: {
    perMinute: 100,
    perHour: 1000,
    perDay: 10000
  },

  // Retry configuration
  retry: {
    attempts: 3,
    delay: 30000, // 30 seconds
    backoff: 'exponential'
  }
}
```

### Queue Configuration

**File**: `packages/worker/src/config/queue.ts`

```typescript
export const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '0')
  },

  jobs: {
    pdf: {
      concurrency: 5,
      priority: 10,
      removeOnComplete: 100,
      removeOnFail: 50
    },
    email: {
      concurrency: 10,
      priority: 5,
      removeOnComplete: 200,
      removeOnFail: 100
    },
    cleanup: {
      concurrency: 1,
      priority: 1,
      removeOnComplete: 10,
      removeOnFail: 10
    }
  }
}
```

## Template Management

### PDF Template Structure

Templates are JSON-based configurations that define PDF layout and content:

**Purchase Order Template** (`packages/api/src/services/pdf/templates/purchase-order-template.json`):

```json
{
  "name": "purchase-order",
  "version": "1.0",
  "pageSize": "letter",
  "margins": {
    "top": 72,
    "bottom": 72,
    "left": 72,
    "right": 72
  },
  "components": [
    {
      "type": "header",
      "config": {
        "logo": "/assets/images/logo.png",
        "title": "Purchase Order",
        "subtitle": "{{purchaseOrder.number}}"
      }
    },
    {
      "type": "vendor-info",
      "config": {
        "title": "Vendor Information",
        "fields": ["name", "address", "phone", "email"]
      }
    },
    {
      "type": "line-items-table",
      "config": {
        "headers": ["Item", "Description", "Quantity", "Unit Price", "Total"],
        "totals": ["subtotal", "tax", "total"]
      }
    },
    {
      "type": "footer",
      "config": {
        "text": "Thank you for your business",
        "pageNumbers": true
      }
    }
  ]
}
```

### Creating Custom Templates

1. **Copy Base Template**
```bash
cp purchase-order-template.json custom-template.json
```

2. **Modify Configuration**
```json
{
  "name": "custom-template",
  "version": "1.0",
  // ... customize components
}
```

3. **Register Template**
```typescript
// In TemplateEngine.ts
export const availableTemplates = {
  'purchase-order': purchaseOrderTemplate,
  'custom-template': customTemplate
}
```

4. **Test Template**
```bash
pnpm --filter api run test:template custom-template
```

### Component Library

**Available Components**:
- `header`: Logos, titles, and document headers
- `vendor-info`: Vendor contact information
- `line-items-table`: Itemized purchase details
- `totals-section`: Financial summaries
- `footer`: Page footers with optional page numbers
- `text-block`: Free-form text sections
- `image`: Static images and graphics
- `spacer`: Vertical spacing control

**Component Configuration**:
Each component accepts specific configuration options. See the [Component Reference](./component-reference.md) for detailed documentation.

## Email Service Configuration

### SMTP Provider Setup

**SendGrid Configuration**:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your_api_key_here
```

**AWS SES Configuration**:
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_access_key_id
SMTP_PASS=your_secret_access_key
```

**Gmail Configuration** (Development only):
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Email Template Management

**HTML Templates** (`packages/api/src/services/email/templates/`):

Templates use Handlebars syntax for dynamic content:

```html
<!-- purchase-order.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Purchase Order {{purchaseOrder.number}}</title>
    <style>
        /* Professional email styling */
    </style>
</head>
<body>
    <h1>Purchase Order {{purchaseOrder.number}}</h1>
    <p>Dear {{vendor.name}},</p>
    <p>Please find attached purchase order {{purchaseOrder.number}} dated {{purchaseOrder.date}}.</p>
    <!-- ... template content ... -->
</body>
</html>
```

**Text Templates**:
```text
Purchase Order {{purchaseOrder.number}}

Dear {{vendor.name}},

Please find attached purchase order {{purchaseOrder.number}} dated {{purchaseOrder.date}}.

Order Details:
{{#each lineItems}}
- {{description}}: {{quantity}} x ${{unitPrice}} = ${{total}}
{{/each}}

Total: ${{purchaseOrder.total}}

Thank you for your business.

{{cidery.name}}
{{cidery.email}}
{{cidery.phone}}
```

### Delivery Tracking

**Webhook Configuration**:
Set up webhooks to track email delivery status:

```typescript
// Webhook endpoint configuration
export const webhookConfig = {
  sendgrid: {
    endpoint: '/api/webhooks/sendgrid',
    events: ['delivered', 'opened', 'clicked', 'bounced', 'dropped']
  },
  aws: {
    endpoint: '/api/webhooks/aws-ses',
    events: ['delivery', 'bounce', 'complaint']
  }
}
```

## Performance Monitoring

### Metrics Collection

**Key Performance Indicators**:
- PDF generation time per document type
- Email delivery success rates
- Queue processing times
- Memory usage during large report generation
- Concurrent user capacity
- Cache hit rates

**Monitoring Configuration** (`packages/api/src/services/monitoring/`):

```typescript
export const monitoringConfig = {
  // Performance thresholds
  thresholds: {
    pdfGeneration: {
      single: 10000,      // 10 seconds
      range: 30000,       // 30 seconds
      large: 120000       // 2 minutes
    },
    emailDelivery: {
      queue: 5000,        // 5 seconds
      send: 15000,        // 15 seconds
      success: 0.95       // 95% success rate
    }
  },

  // Alert configuration
  alerts: {
    enabled: true,
    email: 'admin@yourdomain.com',
    slack: process.env.SLACK_WEBHOOK_URL,
    thresholdFailures: 3
  },

  // Logging
  logging: {
    level: 'info',
    performance: true,
    errors: true,
    audit: true
  }
}
```

### Performance Dashboards

**Metrics Endpoints**:
- `GET /api/admin/metrics/pdf`: PDF generation statistics
- `GET /api/admin/metrics/email`: Email delivery statistics
- `GET /api/admin/metrics/queue`: Background job statistics
- `GET /api/admin/metrics/system`: System resource usage

**Dashboard Integration**:
Connect to monitoring platforms like Grafana, DataDog, or New Relic:

```typescript
// Example Grafana integration
export const grafanaMetrics = {
  pdfGenerationTime: 'pdf_generation_duration_seconds',
  emailDeliveryRate: 'email_delivery_success_rate',
  queueDepth: 'job_queue_depth',
  memoryUsage: 'memory_usage_bytes'
}
```

## Security Configuration

### Access Control

**Role-Based Permissions**:
```typescript
export const reportPermissions = {
  ADMIN: [
    'generate_all_reports',
    'configure_templates',
    'manage_email_settings',
    'view_audit_logs',
    'system_monitoring'
  ],
  MANAGER: [
    'generate_all_reports',
    'view_vendor_reports',
    'email_purchase_orders'
  ],
  OPERATOR: [
    'generate_purchase_orders',
    'email_purchase_orders'
  ],
  VIEWER: [
    'view_reports'
  ]
}
```

### Data Protection

**PDF Encryption**:
```typescript
export const encryptionConfig = {
  enabled: true,
  algorithm: 'AES-256',
  permissions: {
    printing: true,
    modifying: false,
    copying: false,
    annotating: false
  },
  passwords: {
    user: process.env.PDF_USER_PASSWORD,
    owner: process.env.PDF_OWNER_PASSWORD
  }
}
```

**Email Security**:
```typescript
export const emailSecurity = {
  tls: {
    required: true,
    minVersion: 'TLSv1.2'
  },
  attachment: {
    encryption: true,
    passwordProtection: false, // Set to true for sensitive data
    virusScanning: true
  },
  headers: {
    dkim: true,
    spf: true,
    dmarc: true
  }
}
```

### Audit Logging

**Configuration** (`packages/api/src/services/audit/`):
```typescript
export const auditConfig = {
  events: {
    pdfGeneration: true,
    emailSent: true,
    templateAccess: true,
    configChanges: true,
    userActions: true
  },
  retention: {
    days: 365,
    archiveAfter: 90,
    deleteAfter: 2555 // 7 years
  },
  storage: {
    database: true,
    files: false,
    syslog: true
  }
}
```

## Backup and Recovery

### Data Backup

**Database Backup**:
```bash
#!/bin/bash
# Backup script for audit and configuration data
pg_dump -h localhost -U postgres cidery_management > backup_$(date +%Y%m%d).sql
```

**File System Backup**:
```bash
#!/bin/bash
# Backup templates and assets
tar -czf assets_backup_$(date +%Y%m%d).tar.gz \
  assets/ \
  packages/api/src/services/pdf/templates/ \
  packages/api/src/services/email/templates/
```

**Configuration Backup**:
```bash
#!/bin/bash
# Backup environment and configuration files
cp .env .env.backup.$(date +%Y%m%d)
git archive --format=tar.gz --output=config_$(date +%Y%m%d).tar.gz HEAD -- \
  packages/api/src/services/pdf/config.ts \
  packages/api/src/services/email/config.ts \
  packages/worker/src/config/
```

### Disaster Recovery

**Recovery Procedures**:

1. **Database Recovery**:
```bash
# Restore from backup
psql -h localhost -U postgres -d cidery_management < backup_YYYYMMDD.sql
```

2. **File System Recovery**:
```bash
# Restore assets and templates
tar -xzf assets_backup_YYYYMMDD.tar.gz
```

3. **Service Restart**:
```bash
# Restart all services
pnpm --filter api run restart
pnpm --filter worker run restart
```

4. **Verification**:
```bash
# Test system functionality
pnpm --filter api run test:health
curl -f http://localhost:3000/api/health/reports
```

## Troubleshooting

### Common Issues

**PDF Generation Failures**:
```bash
# Check PDF service status
curl http://localhost:3000/api/health/pdf

# Check font availability
ls -la assets/fonts/

# Test template validation
pnpm --filter api run test:template purchase-order

# Check memory usage
free -h
ps aux | grep node
```

**Email Delivery Problems**:
```bash
# Test SMTP connection
pnpm --filter api run test:smtp

# Check email queue status
redis-cli -n 0 llen bull:email

# Review delivery logs
tail -f logs/email-delivery.log

# Test email template rendering
pnpm --filter api run test:email-template purchase-order
```

**Performance Issues**:
```bash
# Check queue depths
redis-cli -n 0 info

# Monitor resource usage
top -p $(pgrep -f "node.*api")

# Check disk space
df -h

# Review slow query logs
tail -f logs/performance.log
```

### Diagnostic Tools

**Health Check Endpoints**:
- `GET /api/health`: Overall system health
- `GET /api/health/pdf`: PDF service status
- `GET /api/health/email`: Email service status
- `GET /api/health/queue`: Background job status
- `GET /api/health/storage`: File storage status

**Diagnostic Commands**:
```bash
# Generate diagnostic report
pnpm --filter api run diagnostic

# Test all services
pnpm test:integration

# Check configuration
pnpm --filter api run config:validate

# Performance benchmark
pnpm --filter api run benchmark
```

## Maintenance Procedures

### Regular Maintenance

**Daily Tasks**:
- Monitor error logs and alert notifications
- Check email delivery success rates
- Verify disk space availability
- Review performance metrics

**Weekly Tasks**:
- Clean up temporary files and expired caches
- Review and rotate log files
- Update email bounce and complaint lists
- Backup configuration and template changes

**Monthly Tasks**:
- Review performance trends and capacity planning
- Update and test disaster recovery procedures
- Audit user access and permissions
- Review and update security configurations

### Automated Maintenance

**Cleanup Jobs** (`packages/worker/src/jobs/cleanup.ts`):
```typescript
export const cleanupJobs = {
  tempFiles: {
    schedule: '0 */2 * * *', // Every 2 hours
    retention: 24 * 60 * 60 * 1000 // 24 hours
  },

  auditLogs: {
    schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
    retention: 90 * 24 * 60 * 60 * 1000 // 90 days
  },

  emailQueue: {
    schedule: '0 3 * * *', // Daily at 3 AM
    removeCompleted: 1000,
    removeFailed: 500
  }
}
```

**Monitoring Jobs**:
```typescript
export const monitoringJobs = {
  healthCheck: {
    schedule: '*/5 * * * *', // Every 5 minutes
    endpoints: ['pdf', 'email', 'queue', 'storage']
  },

  performanceReport: {
    schedule: '0 8 * * 1', // Weekly on Monday at 8 AM
    recipients: ['admin@yourdomain.com']
  },

  capacityPlanning: {
    schedule: '0 9 1 * *', // Monthly on 1st at 9 AM
    metrics: ['usage', 'growth', 'projections']
  }
}
```

### Updates and Upgrades

**Version Updates**:
1. Review changelog and breaking changes
2. Test in staging environment
3. Backup current configuration and data
4. Deploy during maintenance window
5. Verify functionality post-deployment
6. Monitor for issues and performance impacts

**Security Updates**:
1. Monitor security advisories for dependencies
2. Test security patches in isolation
3. Apply critical security updates immediately
4. Schedule non-critical updates for regular maintenance
5. Document and communicate security changes

For additional support and advanced configuration options, contact the development team or refer to the [API Documentation](../../api/reports.md).