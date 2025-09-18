# Purchase Order PDF Reports - Performance Tuning Guide

## Overview

This guide provides detailed recommendations for optimizing the performance of the Purchase Order PDF Reports system. It covers all aspects from database optimization to frontend caching, with specific focus on achieving SLA targets for PDF generation and email delivery.

## Table of Contents

1. [Performance Targets](#performance-targets)
2. [System Architecture Optimization](#system-architecture-optimization)
3. [Database Performance](#database-performance)
4. [PDF Generation Optimization](#pdf-generation-optimization)
5. [Email Service Performance](#email-service-performance)
6. [Caching Strategies](#caching-strategies)
7. [Background Job Optimization](#background-job-optimization)
8. [Frontend Performance](#frontend-performance)
9. [Infrastructure Scaling](#infrastructure-scaling)
10. [Monitoring and Metrics](#monitoring-and-metrics)

## Performance Targets

### Service Level Agreements (SLA)

**PDF Generation Performance**:
- Single purchase order PDF: < 10 seconds (95th percentile)
- Date range reports (50-100 purchases): < 30 seconds (95th percentile)
- Large reports (500+ purchases): < 2 minutes with async processing
- Memory usage: < 512MB per generation process
- Concurrent users: Support 5+ simultaneous generations

**Email Delivery Performance**:
- Email queue processing: < 5 seconds per email
- Email delivery success rate: > 95%
- Email bounce rate: < 3%
- Large attachment handling: < 30 seconds for 25MB files

**System Performance**:
- API response time: < 2 seconds (95th percentile)
- Database query time: < 500ms (95th percentile)
- Cache hit ratio: > 80%
- System availability: > 99.5%

### Performance Monitoring

**Key Performance Indicators (KPIs)**:

```typescript
export interface PerformanceMetrics {
  pdfGeneration: {
    averageTime: number
    p95Time: number
    p99Time: number
    throughput: number
    errorRate: number
    memoryUsage: number
  }
  emailDelivery: {
    queueTime: number
    deliveryTime: number
    successRate: number
    bounceRate: number
    throughput: number
  }
  system: {
    cpuUsage: number
    memoryUsage: number
    diskUsage: number
    networkLatency: number
    cacheHitRatio: number
  }
}
```

## System Architecture Optimization

### Microservices Architecture

**Service Separation**:

```typescript
// Optimized service architecture
export const serviceArchitecture = {
  webApp: {
    port: 3000,
    instances: 2,
    resources: {
      cpu: '1 core',
      memory: '1GB'
    }
  },
  apiService: {
    port: 3001,
    instances: 3,
    resources: {
      cpu: '2 cores',
      memory: '2GB'
    }
  },
  pdfService: {
    port: 3002,
    instances: 2,
    resources: {
      cpu: '2 cores',
      memory: '4GB'  // Higher memory for PDF processing
    }
  },
  emailService: {
    port: 3003,
    instances: 2,
    resources: {
      cpu: '1 core',
      memory: '1GB'
    }
  },
  workerService: {
    instances: 4,
    resources: {
      cpu: '1 core',
      memory: '2GB'
    }
  }
}
```

### Load Balancing

**Nginx Configuration**:

```nginx
upstream pdf_service {
    least_conn;
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3012 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream api_service {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3011 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3021 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    # Connection optimization
    keepalive_timeout 65;
    keepalive_requests 100;

    # Buffer optimization
    client_body_buffer_size 128k;
    client_max_body_size 50m;
    large_client_header_buffers 4 16k;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/pdf;

    # PDF generation endpoint
    location /api/pdf/ {
        proxy_pass http://pdf_service/;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # API endpoints
    location /api/ {
        proxy_pass http://api_service/;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
    }
}
```

## Database Performance

### Query Optimization

**Optimized Database Queries**:

```sql
-- Purchase order report query optimization
EXPLAIN ANALYZE
SELECT
    p.id,
    p.purchase_number,
    p.purchase_date,
    p.total_amount,
    v.name as vendor_name,
    v.email as vendor_email,
    v.address as vendor_address,
    COUNT(pl.id) as line_count,
    SUM(pl.quantity * pl.unit_price) as calculated_total
FROM purchases p
INNER JOIN vendors v ON p.vendor_id = v.id
LEFT JOIN purchase_lines pl ON p.id = pl.purchase_id
WHERE p.purchase_date BETWEEN $1 AND $2
    AND ($3::uuid IS NULL OR p.vendor_id = $3)
GROUP BY p.id, v.id
ORDER BY p.purchase_date DESC
LIMIT $4 OFFSET $5;

-- Create optimized indexes
CREATE INDEX CONCURRENTLY idx_purchases_date_vendor
    ON purchases (purchase_date, vendor_id)
    WHERE purchase_date >= '2024-01-01';

CREATE INDEX CONCURRENTLY idx_purchase_lines_purchase_id_performance
    ON purchase_lines (purchase_id)
    INCLUDE (quantity, unit_price);

CREATE INDEX CONCURRENTLY idx_vendors_active
    ON vendors (id)
    WHERE active = true;
```

**Query Performance Monitoring**:

```typescript
// Query performance tracking
export class QueryPerformanceMonitor {
  static async trackQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await queryFn()
      const duration = Date.now() - startTime

      // Log slow queries
      if (duration > 1000) {
        logger.warn(`Slow query detected: ${queryName} took ${duration}ms`)
      }

      // Update metrics
      queryMetrics.histogram.observe({ query: queryName }, duration / 1000)

      return result
    } catch (error) {
      queryMetrics.errors.inc({ query: queryName })
      throw error
    }
  }
}
```

### Database Configuration

**PostgreSQL Optimization**:

```sql
-- postgresql.conf optimizations for reports workload
shared_buffers = 4GB                    # 25% of RAM for dedicated server
effective_cache_size = 12GB             # 75% of RAM
maintenance_work_mem = 1GB              # For index creation/maintenance
work_mem = 64MB                         # Per query memory
max_connections = 200                   # Based on connection pooling
checkpoint_completion_target = 0.9      # Spread checkpoint I/O
wal_buffers = 32MB                      # WAL buffer size
default_statistics_target = 100         # Better query planning
random_page_cost = 1.1                  # For SSD storage
effective_io_concurrency = 300          # For SSD storage
max_worker_processes = 8                # CPU cores
max_parallel_workers_per_gather = 4    # Parallel query workers
max_parallel_workers = 8               # Total parallel workers
max_parallel_maintenance_workers = 4    # For index builds

-- Connection pooling with PgBouncer
default_pool_size = 50
max_client_conn = 200
pool_mode = transaction
```

**Connection Pooling**:

```typescript
// Optimized database connection configuration
export const dbConfig = {
  pool: {
    min: 5,
    max: 30,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100
  },
  connection: {
    statement_timeout: 30000,
    query_timeout: 30000,
    connectionTimeoutMillis: 2000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  }
}
```

### Data Partitioning

**Time-Based Partitioning**:

```sql
-- Partition audit logs by month for better performance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_2024_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automated partition management
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'audit_logs_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs
                    FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation
SELECT cron.schedule('create_partitions', '0 0 25 * *', 'SELECT create_monthly_partitions();');
```

## PDF Generation Optimization

### Memory Management

**Streaming PDF Generation**:

```typescript
// Memory-efficient PDF generation
export class OptimizedPDFGenerator {
  private readonly STREAMING_THRESHOLD = 1024 * 1024 // 1MB
  private readonly MAX_MEMORY_USAGE = 512 * 1024 * 1024 // 512MB

  async generatePurchaseOrderPDF(
    purchaseId: string,
    options: PDFOptions = {}
  ): Promise<PDFResult> {
    const purchaseData = await this.getPurchaseData(purchaseId)
    const estimatedSize = this.estimatePDFSize(purchaseData)

    if (estimatedSize > this.STREAMING_THRESHOLD) {
      return this.generateStreamingPDF(purchaseData, options)
    } else {
      return this.generateBufferedPDF(purchaseData, options)
    }
  }

  private async generateStreamingPDF(
    data: PurchaseData,
    options: PDFOptions
  ): Promise<PDFResult> {
    const doc = new PDFDocument({
      bufferPages: false, // Don't buffer pages in memory
      autoFirstPage: false
    })

    const chunks: Buffer[] = []
    const stream = new PassThrough()

    doc.pipe(stream)

    // Process data in chunks to control memory usage
    const lineItemChunks = this.chunkArray(data.lineItems, 50)

    for (const chunk of lineItemChunks) {
      doc.addPage()
      await this.renderChunk(doc, chunk)

      // Force garbage collection if available
      if (global.gc && process.memoryUsage().heapUsed > this.MAX_MEMORY_USAGE) {
        global.gc()
      }
    }

    doc.end()

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve({
          buffer,
          size: buffer.length,
          generatedAt: new Date()
        })
      })
      stream.on('error', reject)
    })
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}
```

### Font Optimization

**Font Loading and Caching**:

```typescript
export class FontManager {
  private static fontCache = new Map<string, Buffer>()
  private static readonly FONT_PATH = './assets/fonts'

  static async loadFont(fontName: string): Promise<Buffer> {
    const cacheKey = fontName

    if (this.fontCache.has(cacheKey)) {
      return this.fontCache.get(cacheKey)!
    }

    const fontPath = path.join(this.FONT_PATH, `${fontName}.ttf`)
    const fontBuffer = await fs.readFile(fontPath)

    // Cache font in memory for faster access
    this.fontCache.set(cacheKey, fontBuffer)

    return fontBuffer
  }

  static async preloadFonts(): Promise<void> {
    const fonts = ['Helvetica', 'Helvetica-Bold', 'Arial', 'Times-Roman']

    await Promise.all(
      fonts.map(font => this.loadFont(font))
    )

    logger.info(`Preloaded ${fonts.length} fonts into cache`)
  }

  static getFontCacheStats(): { size: number; fonts: string[] } {
    return {
      size: this.fontCache.size,
      fonts: Array.from(this.fontCache.keys())
    }
  }
}
```

### Template Optimization

**Compiled Template Caching**:

```typescript
export class TemplateOptimizer {
  private static compiledTemplates = new Map<string, CompiledTemplate>()

  static async getCompiledTemplate(templateName: string): Promise<CompiledTemplate> {
    if (this.compiledTemplates.has(templateName)) {
      return this.compiledTemplates.get(templateName)!
    }

    const template = await this.loadTemplate(templateName)
    const compiled = await this.compileTemplate(template)

    // Cache compiled template
    this.compiledTemplates.set(templateName, compiled)

    return compiled
  }

  private static async compileTemplate(template: PDFTemplate): Promise<CompiledTemplate> {
    // Pre-process template for faster rendering
    const optimized = {
      ...template,
      components: template.components.map(component => ({
        ...component,
        // Pre-calculate static positioning
        staticLayout: this.calculateStaticLayout(component),
        // Pre-compile conditional logic
        conditions: this.compileConditions(component.conditions)
      }))
    }

    return {
      template: optimized,
      render: this.createRenderFunction(optimized)
    }
  }
}
```

## Email Service Performance

### SMTP Connection Pooling

**Optimized Email Service**:

```typescript
export class OptimizedEmailService {
  private connectionPool: nodemailer.Transporter[]
  private poolSize: number = 5
  private currentConnection: number = 0

  constructor() {
    this.initializeConnectionPool()
  }

  private initializeConnectionPool(): void {
    this.connectionPool = Array.from({ length: this.poolSize }, () =>
      nodemailer.createTransporter({
        ...smtpConfig,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10, // messages per second
        rateDelta: 1000,
        keepAlive: true
      })
    )
  }

  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    const transporter = this.getNextConnection()

    const startTime = Date.now()

    try {
      const result = await transporter.sendMail({
        ...emailData,
        // Optimize email content
        attachments: await this.optimizeAttachments(emailData.attachments)
      })

      const duration = Date.now() - startTime
      emailMetrics.sendDuration.observe(duration / 1000)

      return {
        messageId: result.messageId,
        success: true,
        duration
      }
    } catch (error) {
      emailMetrics.sendErrors.inc()
      throw error
    }
  }

  private getNextConnection(): nodemailer.Transporter {
    const connection = this.connectionPool[this.currentConnection]
    this.currentConnection = (this.currentConnection + 1) % this.poolSize
    return connection
  }

  private async optimizeAttachments(attachments: Attachment[]): Promise<Attachment[]> {
    return Promise.all(
      attachments.map(async attachment => {
        if (attachment.content && attachment.content.length > 10 * 1024 * 1024) {
          // Compress large attachments
          const compressed = await this.compressAttachment(attachment.content)
          return {
            ...attachment,
            content: compressed,
            encoding: 'base64'
          }
        }
        return attachment
      })
    )
  }
}
```

### Email Queue Optimization

**Background Job Processing**:

```typescript
export class EmailQueueOptimizer {
  private static readonly BATCH_SIZE = 10
  private static readonly CONCURRENT_WORKERS = 3

  static async processBatch(): Promise<void> {
    const workers = Array.from({ length: this.CONCURRENT_WORKERS }, (_, i) =>
      this.createWorker(`worker-${i}`)
    )

    await Promise.all(workers.map(worker => worker.start()))
  }

  private static createWorker(workerId: string) {
    return {
      id: workerId,
      start: async () => {
        while (true) {
          const emails = await this.getEmailBatch(this.BATCH_SIZE)

          if (emails.length === 0) {
            await this.sleep(1000) // Wait 1 second if no emails
            continue
          }

          await Promise.all(
            emails.map(email => this.processEmail(email, workerId))
          )
        }
      }
    }
  }

  private static async processEmail(email: QueuedEmail, workerId: string): Promise<void> {
    const startTime = Date.now()

    try {
      await emailService.sendEmail(email)

      await this.markEmailSent(email.id)

      emailMetrics.processed.inc({ worker: workerId, status: 'success' })
    } catch (error) {
      await this.handleEmailError(email, error)

      emailMetrics.processed.inc({ worker: workerId, status: 'error' })
    } finally {
      const duration = Date.now() - startTime
      emailMetrics.processingTime.observe({ worker: workerId }, duration / 1000)
    }
  }
}
```

## Caching Strategies

### Application-Level Caching

**Multi-Layer Caching**:

```typescript
export class CacheManager {
  private memoryCache: Map<string, CacheEntry> = new Map()
  private redisClient: Redis.Redis
  private readonly MEMORY_CACHE_SIZE = 1000
  private readonly MEMORY_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly REDIS_TTL = 60 * 60 // 1 hour

  async get<T>(key: string): Promise<T | null> {
    // Level 1: Memory cache
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      cacheMetrics.hits.inc({ level: 'memory' })
      return memoryEntry.value as T
    }

    // Level 2: Redis cache
    const redisValue = await this.redisClient.get(key)
    if (redisValue) {
      const value = JSON.parse(redisValue)

      // Populate memory cache
      this.setMemoryCache(key, value)

      cacheMetrics.hits.inc({ level: 'redis' })
      return value as T
    }

    cacheMetrics.misses.inc()
    return null
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Set in both caches
    this.setMemoryCache(key, value)

    await this.redisClient.setex(
      key,
      ttl || this.REDIS_TTL,
      JSON.stringify(value)
    )
  }

  private setMemoryCache<T>(key: string, value: T): void {
    // Implement LRU eviction
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value
      this.memoryCache.delete(oldestKey)
    }

    this.memoryCache.set(key, {
      value,
      timestamp: Date.now()
    })
  }
}
```

### Database Query Caching

**Query Result Caching**:

```typescript
export class QueryCache {
  private static cache = new CacheManager()

  static async cachedQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    ttl: number = 300 // 5 minutes
  ): Promise<T> {
    const cached = await this.cache.get<T>(queryKey)
    if (cached) {
      return cached
    }

    const result = await queryFn()
    await this.cache.set(queryKey, result, ttl)

    return result
  }

  static async getPurchaseData(purchaseId: string): Promise<PurchaseData> {
    return this.cachedQuery(
      `purchase:${purchaseId}`,
      () => db.purchase.findById(purchaseId),
      600 // 10 minutes for purchase data
    )
  }

  static async getVendorData(vendorId: string): Promise<VendorData> {
    return this.cachedQuery(
      `vendor:${vendorId}`,
      () => db.vendor.findById(vendorId),
      1800 // 30 minutes for vendor data
    )
  }

  static async invalidatePurchaseCache(purchaseId: string): Promise<void> {
    const keys = [
      `purchase:${purchaseId}`,
      `purchase:${purchaseId}:lines`,
      `purchase:${purchaseId}:summary`
    ]

    await Promise.all(
      keys.map(key => this.cache.delete(key))
    )
  }
}
```

### CDN and Static Asset Caching

**Asset Optimization**:

```typescript
export class AssetOptimizer {
  static async optimizeImages(): Promise<void> {
    const imageDir = './assets/images'
    const outputDir = './assets/images/optimized'

    const images = await fs.readdir(imageDir)

    await Promise.all(
      images.map(async image => {
        const inputPath = path.join(imageDir, image)
        const outputPath = path.join(outputDir, image)

        // Optimize images for different formats
        await sharp(inputPath)
          .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toFile(outputPath)
      })
    )
  }

  static generateAssetManifest(): AssetManifest {
    return {
      fonts: {
        'helvetica': '/assets/fonts/helvetica.woff2',
        'helvetica-bold': '/assets/fonts/helvetica-bold.woff2'
      },
      images: {
        'logo': '/assets/images/optimized/logo.jpg',
        'letterhead': '/assets/images/optimized/letterhead.jpg'
      },
      version: process.env.ASSET_VERSION || 'latest'
    }
  }
}
```

## Background Job Optimization

### Queue Management

**Optimized Job Processing**:

```typescript
export class JobQueueOptimizer {
  private static readonly PRIORITY_LEVELS = {
    CRITICAL: 1,    // Email delivery failures
    HIGH: 5,        // Purchase order PDFs
    NORMAL: 10,     // Date range reports
    LOW: 15         // Cleanup tasks
  }

  static async configureQueues(): Promise<void> {
    // PDF generation queue
    const pdfQueue = new Bull('pdf-generation', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    })

    // Email queue with higher concurrency
    const emailQueue = new Bull('email-delivery', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    })

    // Configure processing
    pdfQueue.process('generate-purchase-order', 3, this.processPDFJob)
    pdfQueue.process('generate-date-range', 2, this.processDateRangeJob)

    emailQueue.process('send-email', 10, this.processEmailJob)
  }

  private static async processPDFJob(job: Bull.Job): Promise<PDFResult> {
    const { purchaseId, options } = job.data

    // Update job progress
    await job.progress(10)

    const startTime = Date.now()

    try {
      const result = await pdfGenerator.generatePurchaseOrderPDF(purchaseId, options)

      await job.progress(100)

      jobMetrics.completed.inc({ type: 'pdf', status: 'success' })

      return result
    } catch (error) {
      jobMetrics.completed.inc({ type: 'pdf', status: 'error' })
      throw error
    } finally {
      const duration = Date.now() - startTime
      jobMetrics.duration.observe({ type: 'pdf' }, duration / 1000)
    }
  }
}
```

### Resource Management

**Memory and CPU Optimization**:

```typescript
export class ResourceManager {
  private static memoryThreshold = 512 * 1024 * 1024 // 512MB
  private static activeJobs = new Set<string>()

  static async checkResourceAvailability(): Promise<boolean> {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = await this.getCPUUsage()

    return (
      memoryUsage.heapUsed < this.memoryThreshold &&
      cpuUsage < 0.8 && // 80% CPU threshold
      this.activeJobs.size < 10 // Max concurrent jobs
    )
  }

  static async executeWithResourceLimits<T>(
    jobId: string,
    task: () => Promise<T>
  ): Promise<T> {
    if (!await this.checkResourceAvailability()) {
      throw new Error('Insufficient resources')
    }

    this.activeJobs.add(jobId)

    try {
      const result = await task()
      return result
    } finally {
      this.activeJobs.delete(jobId)

      // Force garbage collection if memory usage is high
      if (process.memoryUsage().heapUsed > this.memoryThreshold) {
        if (global.gc) global.gc()
      }
    }
  }

  private static async getCPUUsage(): Promise<number> {
    return new Promise(resolve => {
      const startUsage = process.cpuUsage()

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage)
        const totalUsage = endUsage.user + endUsage.system
        const cpuPercent = totalUsage / 1000000 / 100 // Convert to percentage
        resolve(cpuPercent)
      }, 100)
    })
  }
}
```

## Frontend Performance

### Code Splitting and Lazy Loading

**Optimized React Components**:

```typescript
// Lazy load heavy components
const PDFViewer = lazy(() => import('./PDFViewer'))
const ReportGenerator = lazy(() => import('./ReportGenerator'))
const EmailComposer = lazy(() => import('./EmailComposer'))

// Route-based code splitting
const ReportsPage = lazy(() => import('../pages/ReportsPage'))

export const AppRouter = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/generate" element={<ReportGenerator />} />
      </Routes>
    </Suspense>
  </Router>
)
```

### State Management Optimization

**Efficient Data Fetching**:

```typescript
// Optimized tRPC usage with caching
export const useOptimizedReports = () => {
  const utils = trpc.useContext()

  const reportsQuery = trpc.reports.list.useQuery(
    { limit: 50 },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false
    }
  )

  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: () => {
      // Invalidate related queries
      utils.reports.list.invalidate()
    }
  })

  return {
    reports: reportsQuery.data,
    isLoading: reportsQuery.isLoading,
    generateReport: generateReport.mutate,
    isGenerating: generateReport.isLoading
  }
}
```

### Bundle Optimization

**Webpack Configuration**:

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        pdf: {
          test: /[\\/]pdf[\\/]/,
          name: 'pdf-chunk',
          chunks: 'all',
        }
      }
    },
    usedExports: true,
    sideEffects: false
  },
  resolve: {
    alias: {
      // Use production builds
      'react': 'react/index.js',
      'react-dom': 'react-dom/index.js'
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
              plugins: [
                'babel-plugin-transform-imports' // Tree shaking
              ]
            }
          }
        ]
      }
    ]
  }
}
```

## Infrastructure Scaling

### Horizontal Scaling

**Auto-scaling Configuration**:

```yaml
# Kubernetes auto-scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cidery-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cidery-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

### Database Scaling

**Read Replicas and Connection Pooling**:

```typescript
export class DatabaseCluster {
  private primaryDb: Pool
  private readReplicas: Pool[]
  private currentReplica: number = 0

  constructor() {
    this.primaryDb = new Pool({
      ...primaryDbConfig,
      max: 20,
      idleTimeoutMillis: 30000
    })

    this.readReplicas = replicaConfigs.map(config =>
      new Pool({
        ...config,
        max: 10,
        idleTimeoutMillis: 30000
      })
    )
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    // Route reads to replicas, writes to primary
    if (this.isReadQuery(text)) {
      return this.queryReplica(text, params)
    } else {
      return this.primaryDb.query(text, params)
    }
  }

  private async queryReplica(text: string, params?: any[]): Promise<QueryResult> {
    const replica = this.getNextReplica()

    try {
      return await replica.query(text, params)
    } catch (error) {
      // Fallback to primary if replica fails
      logger.warn('Replica query failed, falling back to primary', error)
      return this.primaryDb.query(text, params)
    }
  }

  private getNextReplica(): Pool {
    const replica = this.readReplicas[this.currentReplica]
    this.currentReplica = (this.currentReplica + 1) % this.readReplicas.length
    return replica
  }

  private isReadQuery(query: string): boolean {
    const trimmed = query.trim().toLowerCase()
    return trimmed.startsWith('select') || trimmed.startsWith('with')
  }
}
```

## Monitoring and Metrics

### Performance Monitoring

**Comprehensive Metrics Collection**:

```typescript
export class PerformanceMonitor {
  private static metrics = {
    httpRequests: new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    }),

    pdfGeneration: new promClient.Histogram({
      name: 'pdf_generation_duration_seconds',
      help: 'Duration of PDF generation in seconds',
      labelNames: ['type', 'size_category'],
      buckets: [1, 5, 10, 30, 60, 120, 300]
    }),

    emailDelivery: new promClient.Histogram({
      name: 'email_delivery_duration_seconds',
      help: 'Duration of email delivery in seconds',
      labelNames: ['provider', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60]
    }),

    cacheHitRatio: new promClient.Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio',
      labelNames: ['cache_type']
    }),

    activeConnections: new promClient.Gauge({
      name: 'database_active_connections',
      help: 'Number of active database connections'
    })
  }

  static recordHTTPRequest(
    method: string,
    route: string,
    status: number,
    duration: number
  ): void {
    this.metrics.httpRequests
      .labels(method, route, status.toString())
      .observe(duration / 1000)
  }

  static recordPDFGeneration(
    type: string,
    sizeCategory: string,
    duration: number
  ): void {
    this.metrics.pdfGeneration
      .labels(type, sizeCategory)
      .observe(duration / 1000)
  }

  static updateCacheHitRatio(cacheType: string, ratio: number): void {
    this.metrics.cacheHitRatio
      .labels(cacheType)
      .set(ratio)
  }
}
```

### Real-time Alerts

**Alert Configuration**:

```yaml
# prometheus-alerts.yml
groups:
- name: cidery-reports
  rules:
  - alert: HighPDFGenerationTime
    expr: histogram_quantile(0.95, pdf_generation_duration_seconds) > 30
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "PDF generation taking too long"
      description: "95th percentile PDF generation time is {{ $value }}s"

  - alert: LowEmailDeliveryRate
    expr: rate(email_delivery_success_total[5m]) / rate(email_delivery_total[5m]) < 0.95
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Email delivery rate below threshold"
      description: "Email delivery success rate is {{ $value | humanizePercentage }}"

  - alert: HighDatabaseConnections
    expr: database_active_connections > 80
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High database connection usage"
      description: "Database has {{ $value }} active connections"

  - alert: LowCacheHitRatio
    expr: cache_hit_ratio{cache_type="redis"} < 0.8
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Low cache hit ratio"
      description: "Redis cache hit ratio is {{ $value | humanizePercentage }}"
```

This performance tuning guide provides comprehensive optimization strategies for all components of the Purchase Order PDF Reports system. Regular monitoring and continuous optimization are essential to maintain optimal performance as the system scales.