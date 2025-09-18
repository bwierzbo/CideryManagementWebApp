# Purchase Order PDF Reports - Installation & Deployment Guide

## Overview

This guide provides step-by-step instructions for installing, configuring, and deploying the Purchase Order PDF Reports system. It covers development, staging, and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Staging Environment](#staging-environment)
4. [Production Deployment](#production-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Service Configuration](#service-configuration)
7. [Database Setup](#database-setup)
8. [Security Configuration](#security-configuration)
9. [Monitoring Setup](#monitoring-setup)
10. [Backup Configuration](#backup-configuration)
11. [Verification & Testing](#verification--testing)
12. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Minimum Requirements**:
- **OS**: Ubuntu 20.04 LTS, CentOS 8, or macOS 11+
- **CPU**: 2 cores, 2.4 GHz
- **Memory**: 4 GB RAM
- **Storage**: 20 GB available space
- **Network**: Reliable internet connection for email delivery

**Recommended Production**:
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4 cores, 3.0 GHz
- **Memory**: 8 GB RAM
- **Storage**: 100 GB SSD with backup storage
- **Network**: High-speed connection with redundancy

### Software Dependencies

**Core Dependencies**:
```bash
# Node.js (version 18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm package manager
npm install -g pnpm

# PostgreSQL (version 14 or higher)
sudo apt-get install -y postgresql postgresql-contrib

# Redis (version 6 or higher)
sudo apt-get install -y redis-server

# Git
sudo apt-get install -y git
```

**Build Dependencies**:
```bash
# For PDF generation native modules
sudo apt-get install -y build-essential python3-dev

# For image processing
sudo apt-get install -y libvips-dev

# For font handling
sudo apt-get install -y fontconfig
```

### External Services

**Email Service Provider** (choose one):
- SendGrid (recommended for production)
- AWS SES
- Mailgun
- Postmark
- SMTP server

**Optional Services**:
- **Monitoring**: DataDog, New Relic, or Grafana
- **Error Tracking**: Sentry
- **File Storage**: AWS S3, Google Cloud Storage, or Azure Blob

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/cidery-management-app.git
cd cidery-management-app
```

### 2. Install Dependencies

```bash
# Install all package dependencies
pnpm install

# Verify installation
pnpm --version
node --version
```

### 3. Environment Configuration

Create development environment file:

```bash
cp .env.example .env.local
```

Configure environment variables:

```bash
# .env.local
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/cidery_development"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-secret-key"

# Email (development - use Ethereal for testing)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT="587"
SMTP_USER="your-ethereal-user"
SMTP_PASS="your-ethereal-pass"
SMTP_FROM_EMAIL="noreply@localhost"
SMTP_FROM_NAME="Cidery Management Dev"

# PDF Generation
PDF_FONT_PATH="./assets/fonts"
PDF_IMAGE_PATH="./assets/images"
PDF_TEMP_PATH="./temp/pdfs"
PDF_MAX_FILE_SIZE="52428800"

# Redis
REDIS_URL="redis://localhost:6379"

# File Storage
FILE_STORAGE_PATH="./storage/reports"
FILE_STORAGE_TTL="86400"

# Development flags
NODE_ENV="development"
DEBUG="true"
```

### 4. Database Setup

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create development database
sudo -u postgres createdb cidery_development

# Run migrations
pnpm db:migrate

# Seed with development data
pnpm db:seed
```

### 5. Redis Setup

```bash
# Start Redis
sudo systemctl start redis-server

# Verify connection
redis-cli ping
# Should return: PONG
```

### 6. Asset Setup

```bash
# Create asset directories
mkdir -p assets/fonts assets/images temp/pdfs storage/reports

# Download default fonts (if not included in repo)
pnpm run setup:fonts

# Copy brand assets
cp your-logo.png assets/images/logo.png
```

### 7. Start Development Servers

```bash
# Start all services in development mode
pnpm dev

# Or start individual services
pnpm --filter web run dev      # Frontend (port 3000)
pnpm --filter api run dev      # API server (port 3001)
pnpm --filter worker run dev   # Background worker
```

### 8. Verify Development Setup

```bash
# Test API health
curl http://localhost:3000/api/health

# Test PDF generation
curl -X POST http://localhost:3000/api/test/pdf

# Test email service
curl -X POST http://localhost:3000/api/test/email
```

## Staging Environment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt-get install -y nodejs npm postgresql redis-server nginx certbot

# Install pnpm
npm install -g pnpm

# Create application user
sudo useradd -m -s /bin/bash cideryapp
sudo usermod -aG sudo cideryapp
```

### 2. Application Deployment

```bash
# Switch to application user
sudo su - cideryapp

# Clone repository
git clone https://github.com/your-org/cidery-management-app.git
cd cidery-management-app

# Install dependencies
pnpm install

# Build application
pnpm build
```

### 3. Environment Configuration

```bash
# Create staging environment file
cp .env.example .env.staging

# Configure for staging
nano .env.staging
```

Staging environment variables:

```bash
# Database
DATABASE_URL="postgresql://cidery_user:secure_password@localhost:5432/cidery_staging"

# Authentication
NEXTAUTH_URL="https://staging.yourdomain.com"
NEXTAUTH_SECRET="your-staging-secret-key"

# Email (use staging SendGrid account)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="your-staging-sendgrid-key"
SMTP_FROM_EMAIL="staging@yourdomain.com"
SMTP_FROM_NAME="Cidery Management Staging"

# PDF Generation
PDF_FONT_PATH="/home/cideryapp/assets/fonts"
PDF_IMAGE_PATH="/home/cideryapp/assets/images"
PDF_TEMP_PATH="/tmp/cidery/pdfs"
PDF_MAX_FILE_SIZE="52428800"

# Redis
REDIS_URL="redis://localhost:6379/1"

# File Storage
FILE_STORAGE_PATH="/var/cidery/reports"
FILE_STORAGE_TTL="86400"

# Production flags
NODE_ENV="staging"
DEBUG="false"
```

### 4. Database Setup

```bash
# Create staging database
sudo -u postgres createdb cidery_staging
sudo -u postgres createuser cidery_user
sudo -u postgres psql -c "ALTER USER cidery_user PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE cidery_staging TO cidery_user;"

# Run migrations
pnpm db:migrate

# Seed with staging data
pnpm db:seed:staging
```

### 5. Process Management

Create systemd service files:

```bash
# API service
sudo nano /etc/systemd/system/cidery-api.service
```

```ini
[Unit]
Description=Cidery Management API
After=network.target

[Service]
Type=simple
User=cideryapp
WorkingDirectory=/home/cideryapp/cidery-management-app
Environment=NODE_ENV=staging
EnvironmentFile=/home/cideryapp/cidery-management-app/.env.staging
ExecStart=/usr/bin/node packages/api/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Worker service
sudo nano /etc/systemd/system/cidery-worker.service
```

```ini
[Unit]
Description=Cidery Management Worker
After=network.target

[Service]
Type=simple
User=cideryapp
WorkingDirectory=/home/cideryapp/cidery-management-app
Environment=NODE_ENV=staging
EnvironmentFile=/home/cideryapp/cidery-management-app/.env.staging
ExecStart=/usr/bin/node packages/worker/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Start services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cidery-api cidery-worker
sudo systemctl start cidery-api cidery-worker
```

### 6. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/cidery-staging
```

```nginx
server {
    listen 80;
    server_name staging.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # File upload limits for PDF generation
    client_max_body_size 50M;
}
```

Enable site and restart nginx:

```bash
sudo ln -s /etc/nginx/sites-available/cidery-staging /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL Certificate

```bash
# Install SSL certificate
sudo certbot --nginx -d staging.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

## Production Deployment

### 1. Infrastructure Planning

**Server Architecture**:
- **Web Server**: Load balancer + multiple app instances
- **Database**: PostgreSQL with replication
- **Cache**: Redis cluster
- **File Storage**: Network-attached storage or cloud storage
- **Monitoring**: Comprehensive logging and alerting

**Deployment Options**:
- **Docker**: Containerized deployment with orchestration
- **Traditional**: Direct server deployment with process management
- **Cloud**: Managed services (Heroku, AWS, Azure, GCP)

### 2. Docker Deployment

**Dockerfile**:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:18-alpine AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy assets
COPY --from=builder /app/assets ./assets

# Create temp directories
RUN mkdir -p /tmp/cidery/pdfs
RUN chown -R nextjs:nodejs /tmp/cidery

USER nextjs

EXPOSE 3000 3001

CMD ["node", "dist/index.js"]
```

**Docker Compose**:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/cidery
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./storage:/app/storage
      - ./logs:/app/logs

  worker:
    build: .
    command: node dist/worker/index.js
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/cidery
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=cidery
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 3. Cloud Deployment

**Heroku Deployment**:

```bash
# Create Heroku app
heroku create cidery-management-prod

# Add database
heroku addons:create heroku-postgresql:standard-0

# Add Redis
heroku addons:create heroku-redis:premium-0

# Configure environment variables
heroku config:set NODE_ENV=production
heroku config:set NEXTAUTH_SECRET=your-production-secret
heroku config:set SMTP_HOST=smtp.sendgrid.net
heroku config:set SMTP_USER=apikey
heroku config:set SMTP_PASS=your-production-sendgrid-key

# Deploy
git push heroku main

# Run migrations
heroku run pnpm db:migrate
```

**AWS Deployment**:

Use AWS services:
- **EC2**: Application servers
- **RDS**: PostgreSQL database
- **ElastiCache**: Redis
- **S3**: File storage
- **CloudFront**: CDN
- **Load Balancer**: Traffic distribution
- **CloudWatch**: Monitoring

### 4. Production Environment Variables

```bash
# .env.production
# Database
DATABASE_URL="postgresql://user:password@prod-db.amazonaws.com:5432/cidery_prod"

# Authentication
NEXTAUTH_URL="https://app.yourdomain.com"
NEXTAUTH_SECRET="your-ultra-secure-production-secret"

# Email
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="your-production-sendgrid-key"
SMTP_FROM_EMAIL="noreply@yourdomain.com"
SMTP_FROM_NAME="Cidery Management"

# PDF Generation
PDF_FONT_PATH="/app/assets/fonts"
PDF_IMAGE_PATH="/app/assets/images"
PDF_TEMP_PATH="/tmp/cidery/pdfs"
PDF_MAX_FILE_SIZE="52428800"
PDF_ENCRYPTION_ENABLED="true"

# Redis
REDIS_URL="redis://prod-redis.amazonaws.com:6379"

# File Storage (AWS S3)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
S3_BUCKET_NAME="cidery-reports-prod"
FILE_STORAGE_TTL="259200"  # 3 days

# Security
AUDIT_LOGGING_ENABLED="true"
RATE_LIMIT_ENABLED="true"
RATE_LIMIT_PER_MINUTE="100"

# Monitoring
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project"
LOG_LEVEL="info"
PERFORMANCE_MONITORING="true"

# Production flags
NODE_ENV="production"
DEBUG="false"
```

## Environment Configuration

### Development Environment

Optimized for development workflow:

```bash
# Development-specific settings
DEBUG="true"
NODE_ENV="development"
LOG_LEVEL="debug"
WATCH_FILES="true"
HOT_RELOAD="true"
```

### Staging Environment

Production-like with debugging enabled:

```bash
# Staging-specific settings
DEBUG="false"
NODE_ENV="staging"
LOG_LEVEL="info"
PERFORMANCE_MONITORING="true"
TEST_EMAIL_DELIVERY="true"
```

### Production Environment

Optimized for performance and security:

```bash
# Production-specific settings
DEBUG="false"
NODE_ENV="production"
LOG_LEVEL="warn"
COMPRESSION="true"
MINIFY_OUTPUT="true"
SECURITY_HEADERS="true"
```

## Service Configuration

### Email Service Configuration

**SendGrid Setup**:

```bash
# Create SendGrid account and API key
# Configure domain authentication
# Set up webhook endpoints

# Test configuration
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "test@yourdomain.com"}]}],
    "from": {"email": "noreply@yourdomain.com"},
    "subject": "Test Email",
    "content": [{"type": "text/plain", "value": "Test"}]
  }'
```

**SMTP Configuration**:

```bash
# Test SMTP connection
telnet your-smtp-server.com 587

# Test authentication
echo -n 'username' | base64
echo -n 'password' | base64
```

### File Storage Configuration

**Local Storage**:

```bash
# Create storage directories
sudo mkdir -p /var/cidery/reports
sudo mkdir -p /var/cidery/temp
sudo mkdir -p /var/cidery/assets

# Set permissions
sudo chown -R cideryapp:cideryapp /var/cidery
sudo chmod -R 755 /var/cidery
```

**AWS S3 Configuration**:

```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Create S3 bucket
aws s3 mb s3://cidery-reports-prod

# Set bucket policy
aws s3api put-bucket-policy --bucket cidery-reports-prod --policy file://bucket-policy.json
```

## Database Setup

### PostgreSQL Configuration

**Performance Tuning**:

```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

**Index Creation**:

```sql
-- Performance indexes for reports
CREATE INDEX CONCURRENTLY idx_purchases_created_at ON purchases (created_at);
CREATE INDEX CONCURRENTLY idx_purchases_vendor_id ON purchases (vendor_id);
CREATE INDEX CONCURRENTLY idx_purchase_lines_purchase_id ON purchase_lines (purchase_id);
CREATE INDEX CONCURRENTLY idx_vendors_name ON vendors (name);

-- Audit table indexes
CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp ON audit_logs (timestamp);
CREATE INDEX CONCURRENTLY idx_audit_logs_entity_type ON audit_logs (entity_type);
```

**Backup Configuration**:

```bash
# Create backup script
#!/bin/bash
BACKUP_DIR="/var/backups/cidery"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="cidery_backup_$DATE.sql"

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U cidery_user -d cidery_prod > $BACKUP_DIR/$FILENAME

# Compress backup
gzip $BACKUP_DIR/$FILENAME

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/$FILENAME.gz s3://cidery-backups/database/
```

Set up cron job:

```bash
# Add to crontab
0 2 * * * /usr/local/bin/backup_cidery_db.sh
```

## Security Configuration

### SSL/TLS Setup

**Let's Encrypt Certificate**:

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d app.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

**Custom Certificate**:

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out certificate.csr

# Install certificate
sudo cp certificate.crt /etc/ssl/certs/
sudo cp private.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/private.key
```

### Firewall Configuration

```bash
# Configure UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3000/tcp  # Block direct app access
sudo ufw deny 3001/tcp  # Block direct API access
sudo ufw enable

# Check status
sudo ufw status verbose
```

### Application Security

**Environment Variables Protection**:

```bash
# Secure environment file permissions
chmod 600 .env.production

# Use secret management service
# AWS Secrets Manager, Azure Key Vault, etc.
```

**Database Security**:

```sql
-- Create limited user for application
CREATE USER cidery_app WITH PASSWORD 'secure_random_password';
GRANT CONNECT ON DATABASE cidery_prod TO cidery_app;
GRANT USAGE ON SCHEMA public TO cidery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cidery_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cidery_app;

-- Revoke unnecessary permissions
REVOKE ALL ON pg_user FROM cidery_app;
REVOKE ALL ON pg_roles FROM cidery_app;
```

## Monitoring Setup

### Application Monitoring

**Health Check Endpoints**:

```typescript
// Health check configuration
export const healthChecks = {
  database: async () => {
    const result = await db.query('SELECT 1')
    return result.rows.length === 1
  },
  redis: async () => {
    const result = await redis.ping()
    return result === 'PONG'
  },
  email: async () => {
    // Test SMTP connection
    return await testEmailConnection()
  },
  storage: async () => {
    // Test file system access
    return await testFileAccess()
  }
}
```

**Prometheus Metrics**:

```typescript
// metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client'

export const metrics = {
  httpRequests: new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status']
  }),

  pdfGeneration: new Histogram({
    name: 'pdf_generation_duration_seconds',
    help: 'Time taken to generate PDFs',
    labelNames: ['type', 'size']
  }),

  emailDelivery: new Counter({
    name: 'email_delivery_total',
    help: 'Total number of emails sent',
    labelNames: ['status', 'provider']
  }),

  activeUsers: new Gauge({
    name: 'active_users',
    help: 'Number of active users'
  })
}
```

**Grafana Dashboard**:

```json
{
  "dashboard": {
    "title": "Cidery Management Reports",
    "panels": [
      {
        "title": "PDF Generation Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(pdf_generation_duration_seconds_count[5m])"
          }
        ]
      },
      {
        "title": "Email Delivery Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(email_delivery_total{status=\"sent\"}[5m]) / rate(email_delivery_total[5m])"
          }
        ]
      }
    ]
  }
}
```

### Log Management

**Log Configuration**:

```typescript
// logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})
```

**Log Rotation**:

```bash
# /etc/logrotate.d/cidery
/var/log/cidery/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 cideryapp cideryapp
    postrotate
        systemctl reload cidery-api cidery-worker
    endscript
}
```

## Backup Configuration

### Automated Backups

**Database Backup Script**:

```bash
#!/bin/bash
# backup-database.sh

set -e

BACKUP_DIR="/var/backups/cidery"
S3_BUCKET="cidery-backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="cidery_db_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
pg_dump $DATABASE_URL > $BACKUP_DIR/$FILENAME

# Compress
gzip $BACKUP_DIR/$FILENAME

# Upload to S3
aws s3 cp $BACKUP_DIR/$FILENAME.gz s3://$S3_BUCKET/database/

# Clean local backups older than 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

# Log completion
echo "Database backup completed: $FILENAME.gz"
```

**Application Files Backup**:

```bash
#!/bin/bash
# backup-files.sh

set -e

BACKUP_DIR="/var/backups/cidery"
S3_BUCKET="cidery-backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="cidery_files_$DATE.tar.gz"

# Create backup
tar -czf $BACKUP_DIR/$FILENAME \
  /var/cidery/reports \
  /home/cideryapp/cidery-management-app/assets \
  /home/cideryapp/cidery-management-app/.env.production

# Upload to S3
aws s3 cp $BACKUP_DIR/$FILENAME s3://$S3_BUCKET/files/

# Clean local backups
find $BACKUP_DIR -name "cidery_files_*.tar.gz" -mtime +7 -delete
```

**Backup Schedule**:

```bash
# Add to root crontab
sudo crontab -e

# Database backup every 6 hours
0 */6 * * * /usr/local/bin/backup-database.sh

# File backup daily at 3 AM
0 3 * * * /usr/local/bin/backup-files.sh

# Weekly full system backup
0 1 * * 0 /usr/local/bin/backup-full-system.sh
```

## Verification & Testing

### Post-Deployment Verification

**Automated Health Checks**:

```bash
#!/bin/bash
# verify-deployment.sh

set -e

BASE_URL="https://app.yourdomain.com"

# Test API health
echo "Testing API health..."
curl -f $BASE_URL/api/health

# Test authentication
echo "Testing authentication..."
curl -f $BASE_URL/api/auth/session

# Test PDF generation
echo "Testing PDF service..."
curl -f $BASE_URL/api/health/pdf

# Test email service
echo "Testing email service..."
curl -f $BASE_URL/api/health/email

# Test database connection
echo "Testing database..."
curl -f $BASE_URL/api/health/database

echo "All health checks passed!"
```

**Load Testing**:

```bash
# Install artillery
npm install -g artillery

# Load test configuration (artillery.yml)
config:
  target: 'https://app.yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "PDF Generation"
    requests:
      - post:
          url: "/api/reports/generate"
          json:
            purchaseId: "test-purchase-123"

# Run load test
artillery run artillery.yml
```

**Integration Tests**:

```typescript
// integration.test.ts
describe('Reports Integration', () => {
  test('should generate PDF for purchase order', async () => {
    const result = await request(app)
      .post('/api/reports/generate')
      .send({ purchaseId: 'test-purchase' })
      .expect(200)

    expect(result.body.downloadUrl).toBeDefined()
    expect(result.body.fileSize).toBeGreaterThan(0)
  })

  test('should send email with PDF attachment', async () => {
    const result = await request(app)
      .post('/api/email/send-purchase-order')
      .send({
        purchaseId: 'test-purchase',
        to: 'test@example.com'
      })
      .expect(200)

    expect(result.body.emailId).toBeDefined()
  })
})
```

### Performance Testing

**PDF Generation Performance**:

```typescript
// performance.test.ts
describe('PDF Performance', () => {
  test('single purchase order should generate within 10 seconds', async () => {
    const start = Date.now()

    await generatePurchaseOrderPDF('test-purchase')

    const duration = Date.now() - start
    expect(duration).toBeLessThan(10000)
  })

  test('should handle 5 concurrent generations', async () => {
    const promises = Array(5).fill(null).map(() =>
      generatePurchaseOrderPDF('test-purchase')
    )

    const results = await Promise.all(promises)
    expect(results).toHaveLength(5)
    results.forEach(result => {
      expect(result.success).toBe(true)
    })
  })
})
```

## Troubleshooting

### Common Installation Issues

**Node.js Version Mismatch**:

```bash
# Check Node.js version
node --version

# Install correct version using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**PostgreSQL Connection Issues**:

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U postgres -c "SELECT version();"

# Check configuration
sudo nano /etc/postgresql/14/main/postgresql.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

**Redis Connection Issues**:

```bash
# Check Redis status
sudo systemctl status redis-server

# Test connection
redis-cli ping

# Check configuration
sudo nano /etc/redis/redis.conf
```

**Permission Issues**:

```bash
# Fix file permissions
sudo chown -R cideryapp:cideryapp /home/cideryapp/cidery-management-app
chmod 755 /home/cideryapp/cidery-management-app
chmod 600 /home/cideryapp/cidery-management-app/.env.*

# Fix storage permissions
sudo mkdir -p /var/cidery
sudo chown -R cideryapp:cideryapp /var/cidery
chmod 755 /var/cidery
```

### Deployment Issues

**Service Start Failures**:

```bash
# Check service logs
sudo journalctl -u cidery-api -f
sudo journalctl -u cidery-worker -f

# Check application logs
tail -f /home/cideryapp/cidery-management-app/logs/error.log

# Restart services
sudo systemctl restart cidery-api cidery-worker
```

**Database Migration Failures**:

```bash
# Check migration status
pnpm db:status

# Rollback and retry
pnpm db:rollback
pnpm db:migrate

# Manual migration
psql $DATABASE_URL -f migrations/001_initial.sql
```

**Build Failures**:

```bash
# Clean build cache
rm -rf node_modules dist
pnpm install
pnpm build

# Check build logs
pnpm build 2>&1 | tee build.log
```

### Performance Issues

**High Memory Usage**:

```bash
# Monitor memory usage
watch 'ps aux --sort=-%mem | head -20'

# Check Node.js memory
node --inspect packages/api/dist/index.js

# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

**Slow Database Queries**:

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

For additional deployment scenarios and advanced configuration options, refer to the [Platform-Specific Deployment Guides](./deployment/) and [Cloud Provider Documentation](./cloud/).