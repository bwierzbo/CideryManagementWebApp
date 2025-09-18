# Purchase Order PDF Reports - API Documentation

## Overview

The Purchase Order PDF Reports API provides programmatic access to PDF generation, email delivery, and report management functionality. The API is built using tRPC for type-safe client-server communication.

## Base URL

```
http://localhost:3000/api/trpc
```

## Authentication

All API endpoints require authentication using NextAuth.js session tokens.

```typescript
// Client setup
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/routers'

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers: {
        // Include session token
        authorization: `Bearer ${sessionToken}`
      }
    })
  ]
})
```

## Reports Router

### Generate Purchase Order PDF

Generate a PDF for a single purchase order.

**Endpoint**: `reports.generatePurchaseOrder`

**Method**: Mutation

**Input**:
```typescript
interface GeneratePurchaseOrderInput {
  purchaseId: string
  options?: {
    includeLineItems?: boolean
    includeVendorNotes?: boolean
    format?: 'letter' | 'a4'
    compression?: boolean
  }
}
```

**Output**:
```typescript
interface GeneratePurchaseOrderOutput {
  success: boolean
  fileId: string
  downloadUrl: string
  fileName: string
  fileSize: number
  generatedAt: string
}
```

**Example**:
```typescript
const result = await trpc.reports.generatePurchaseOrder.mutate({
  purchaseId: 'purchase-123',
  options: {
    includeLineItems: true,
    includeVendorNotes: true,
    format: 'letter',
    compression: true
  }
})

console.log(result.downloadUrl) // Download PDF from this URL
```

**Error Responses**:
- `400 Bad Request`: Invalid purchase ID or options
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Purchase order not found
- `500 Internal Server Error`: PDF generation failed

### Generate Date Range Report

Generate a comprehensive report for a date range.

**Endpoint**: `reports.generateDateRangeReport`

**Method**: Mutation

**Input**:
```typescript
interface GenerateDateRangeReportInput {
  startDate: string // ISO 8601 format
  endDate: string   // ISO 8601 format
  filters?: {
    vendorIds?: string[]
    categories?: string[]
    minAmount?: number
    maxAmount?: number
    includeVendorAnalysis?: boolean
    includeTrendAnalysis?: boolean
  }
  format?: 'summary' | 'detailed' | 'executive'
  delivery?: {
    email?: string
    priority?: 'low' | 'normal' | 'high'
  }
}
```

**Output**:
```typescript
interface GenerateDateRangeReportOutput {
  success: boolean
  reportId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  estimatedCompletion?: string
  downloadUrl?: string
  fileSize?: number
  generatedAt?: string
}
```

**Example**:
```typescript
const report = await trpc.reports.generateDateRangeReport.mutate({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z',
  filters: {
    vendorIds: ['vendor-1', 'vendor-2'],
    includeVendorAnalysis: true,
    includeTrendAnalysis: true
  },
  format: 'detailed',
  delivery: {
    email: 'manager@cidery.com',
    priority: 'normal'
  }
})

// Check status periodically
const status = await trpc.reports.getReportStatus.query({
  reportId: report.reportId
})
```

### Get Report Status

Check the status of an asynchronous report generation.

**Endpoint**: `reports.getReportStatus`

**Method**: Query

**Input**:
```typescript
interface GetReportStatusInput {
  reportId: string
}
```

**Output**:
```typescript
interface GetReportStatusOutput {
  reportId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress?: number // 0-100
  estimatedCompletion?: string
  downloadUrl?: string
  error?: string
  createdAt: string
  completedAt?: string
}
```

**Example**:
```typescript
const status = await trpc.reports.getReportStatus.query({
  reportId: 'report-456'
})

if (status.status === 'completed') {
  // Download the report
  window.open(status.downloadUrl)
}
```

### List Report History

Get a list of previously generated reports.

**Endpoint**: `reports.listReports`

**Method**: Query

**Input**:
```typescript
interface ListReportsInput {
  filters?: {
    userId?: string
    type?: 'purchase-order' | 'date-range' | 'vendor-analysis'
    status?: 'completed' | 'failed' | 'processing'
    startDate?: string
    endDate?: string
  }
  pagination?: {
    limit?: number // Default: 50, Max: 100
    offset?: number // Default: 0
  }
  orderBy?: {
    field: 'createdAt' | 'completedAt' | 'fileSize'
    direction: 'asc' | 'desc'
  }
}
```

**Output**:
```typescript
interface ListReportsOutput {
  reports: Array<{
    id: string
    type: 'purchase-order' | 'date-range' | 'vendor-analysis'
    status: 'completed' | 'failed' | 'processing'
    fileName: string
    fileSize?: number
    downloadUrl?: string
    createdAt: string
    completedAt?: string
    expiresAt?: string
  }>
  totalCount: number
  hasMore: boolean
}
```

**Example**:
```typescript
const reports = await trpc.reports.listReports.query({
  filters: {
    type: 'date-range',
    status: 'completed'
  },
  pagination: {
    limit: 20,
    offset: 0
  },
  orderBy: {
    field: 'createdAt',
    direction: 'desc'
  }
})
```

## Email Router

### Send Purchase Order Email

Email a purchase order PDF to a vendor.

**Endpoint**: `email.sendPurchaseOrder`

**Method**: Mutation

**Input**:
```typescript
interface SendPurchaseOrderInput {
  purchaseId: string
  emailOptions: {
    to: string
    cc?: string[]
    bcc?: string[]
    subject?: string
    message?: string
    template?: 'standard' | 'formal' | 'casual'
    priority?: 'low' | 'normal' | 'high'
    requestReadReceipt?: boolean
  }
  pdfOptions?: {
    includeLineItems?: boolean
    includeVendorNotes?: boolean
    format?: 'letter' | 'a4'
  }
}
```

**Output**:
```typescript
interface SendPurchaseOrderOutput {
  success: boolean
  emailId: string
  messageId: string
  status: 'queued' | 'sent' | 'failed'
  estimatedDelivery?: string
  sentAt?: string
}
```

**Example**:
```typescript
const result = await trpc.email.sendPurchaseOrder.mutate({
  purchaseId: 'purchase-123',
  emailOptions: {
    to: 'vendor@supplier.com',
    cc: ['manager@cidery.com'],
    subject: 'Purchase Order #PO-2024-001',
    message: 'Please find attached our purchase order.',
    template: 'formal',
    priority: 'normal',
    requestReadReceipt: true
  },
  pdfOptions: {
    includeLineItems: true,
    includeVendorNotes: true,
    format: 'letter'
  }
})

// Track delivery status
const status = await trpc.email.getEmailStatus.query({
  emailId: result.emailId
})
```

### Get Email Delivery Status

Check the delivery status of a sent email.

**Endpoint**: `email.getEmailStatus`

**Method**: Query

**Input**:
```typescript
interface GetEmailStatusInput {
  emailId: string
}
```

**Output**:
```typescript
interface GetEmailStatusOutput {
  emailId: string
  messageId: string
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed'
  events: Array<{
    type: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
    timestamp: string
    details?: string
  }>
  recipient: string
  subject: string
  sentAt?: string
  deliveredAt?: string
  openedAt?: string
  bounceReason?: string
  error?: string
}
```

**Example**:
```typescript
const status = await trpc.email.getEmailStatus.query({
  emailId: 'email-789'
})

console.log(`Email status: ${status.status}`)
status.events.forEach(event => {
  console.log(`${event.type}: ${event.timestamp}`)
})
```

### List Email History

Get a list of sent emails with their delivery status.

**Endpoint**: `email.listEmails`

**Method**: Query

**Input**:
```typescript
interface ListEmailsInput {
  filters?: {
    purchaseId?: string
    recipient?: string
    status?: 'sent' | 'delivered' | 'bounced' | 'failed'
    startDate?: string
    endDate?: string
  }
  pagination?: {
    limit?: number // Default: 50, Max: 100
    offset?: number // Default: 0
  }
  orderBy?: {
    field: 'sentAt' | 'deliveredAt' | 'status'
    direction: 'asc' | 'desc'
  }
}
```

**Output**:
```typescript
interface ListEmailsOutput {
  emails: Array<{
    id: string
    messageId: string
    purchaseId?: string
    recipient: string
    subject: string
    status: 'sent' | 'delivered' | 'bounced' | 'failed'
    sentAt: string
    deliveredAt?: string
    openedAt?: string
  }>
  totalCount: number
  hasMore: boolean
}
```

## Monitoring Router

### Get System Health

Check the health status of report generation services.

**Endpoint**: `monitoring.getHealth`

**Method**: Query

**Input**: None

**Output**:
```typescript
interface GetHealthOutput {
  status: 'healthy' | 'warning' | 'critical'
  timestamp: string
  services: {
    pdf: {
      status: 'healthy' | 'warning' | 'critical'
      responseTime?: number
      errorRate?: number
      queueDepth?: number
    }
    email: {
      status: 'healthy' | 'warning' | 'critical'
      responseTime?: number
      deliveryRate?: number
      bounceRate?: number
    }
    storage: {
      status: 'healthy' | 'warning' | 'critical'
      diskUsage?: number
      cacheHitRate?: number
    }
    queue: {
      status: 'healthy' | 'warning' | 'critical'
      activeJobs?: number
      failedJobs?: number
      processingRate?: number
    }
  }
}
```

**Example**:
```typescript
const health = await trpc.monitoring.getHealth.query()

if (health.status !== 'healthy') {
  console.warn('System health issues detected:', health.services)
}
```

### Get Performance Metrics

Get detailed performance metrics for monitoring and optimization.

**Endpoint**: `monitoring.getMetrics`

**Method**: Query

**Input**:
```typescript
interface GetMetricsInput {
  timeRange?: {
    start: string // ISO 8601
    end: string   // ISO 8601
  }
  granularity?: 'minute' | 'hour' | 'day'
  metrics?: string[] // Specific metrics to return
}
```

**Output**:
```typescript
interface GetMetricsOutput {
  timeRange: {
    start: string
    end: string
  }
  metrics: {
    pdfGeneration: {
      totalRequests: number
      successRate: number
      averageTime: number
      maxTime: number
      errorRate: number
    }
    emailDelivery: {
      totalSent: number
      deliveryRate: number
      bounceRate: number
      openRate: number
      averageDeliveryTime: number
    }
    systemResources: {
      cpuUsage: number
      memoryUsage: number
      diskUsage: number
      networkTraffic: number
    }
    userActivity: {
      activeUsers: number
      reportsGenerated: number
      emailsSent: number
      downloadCount: number
    }
  }
  timeSeries?: Array<{
    timestamp: string
    values: Record<string, number>
  }>
}
```

## Error Handling

### Standard Error Response

All endpoints return errors in a consistent format:

```typescript
interface APIError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
  requestId: string
}
```

### Common Error Codes

**Authentication Errors**:
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `SESSION_EXPIRED`: Authentication session has expired

**Validation Errors**:
- `INVALID_INPUT`: Request data validation failed
- `MISSING_REQUIRED_FIELD`: Required field is missing
- `INVALID_FORMAT`: Data format is incorrect

**Business Logic Errors**:
- `PURCHASE_NOT_FOUND`: Purchase order does not exist
- `VENDOR_NOT_FOUND`: Vendor information is missing
- `INSUFFICIENT_DATA`: Not enough data to generate report

**System Errors**:
- `PDF_GENERATION_FAILED`: PDF creation encountered an error
- `EMAIL_DELIVERY_FAILED`: Email could not be sent
- `STORAGE_ERROR`: File storage operation failed
- `QUEUE_FULL`: Background job queue is at capacity

**Rate Limiting**:
- `RATE_LIMIT_EXCEEDED`: Too many requests in time window
- `QUOTA_EXCEEDED`: Usage quota has been exceeded

### Error Handling Best Practices

```typescript
try {
  const result = await trpc.reports.generatePurchaseOrder.mutate({
    purchaseId: 'purchase-123'
  })
  return result
} catch (error) {
  if (error.code === 'PURCHASE_NOT_FOUND') {
    // Handle missing purchase order
    throw new Error('The specified purchase order was not found')
  } else if (error.code === 'PDF_GENERATION_FAILED') {
    // Handle PDF generation failure
    console.error('PDF generation failed:', error.details)
    throw new Error('Unable to generate PDF. Please try again.')
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limiting
    const retryAfter = error.details?.retryAfter || 60
    throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`)
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error)
    throw new Error('An unexpected error occurred. Please contact support.')
  }
}
```

## Rate Limiting

### Default Limits

- **PDF Generation**: 10 requests per minute per user
- **Email Sending**: 20 requests per minute per user
- **Report Queries**: 100 requests per minute per user
- **File Downloads**: 50 requests per minute per user

### Rate Limit Headers

API responses include rate limiting information:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 45
```

### Handling Rate Limits

```typescript
const makeRequestWithRetry = async (requestFn: () => Promise<any>, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn()
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && attempt < maxRetries - 1) {
        const retryAfter = error.details?.retryAfter || 60
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        continue
      }
      throw error
    }
  }
}

// Usage
const result = await makeRequestWithRetry(() =>
  trpc.reports.generatePurchaseOrder.mutate({ purchaseId: 'purchase-123' })
)
```

## Webhooks

### Email Delivery Webhooks

Configure webhooks to receive real-time email delivery notifications.

**Endpoint Configuration**:
```typescript
// In environment variables
WEBHOOK_EMAIL_DELIVERY_URL=https://your-app.com/webhooks/email-delivery
WEBHOOK_EMAIL_DELIVERY_SECRET=your-webhook-secret
```

**Webhook Payload**:
```typescript
interface EmailWebhookPayload {
  event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  timestamp: string
  emailId: string
  messageId: string
  recipient: string
  purchaseId?: string
  details?: {
    userAgent?: string
    ip?: string
    bounceReason?: string
    errorMessage?: string
  }
  signature: string // HMAC-SHA256 signature for verification
}
```

**Webhook Verification**:
```typescript
import crypto from 'crypto'

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}
```

## SDK Examples

### TypeScript Client

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@/server/routers'

class ReportsClient {
  private trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>>

  constructor(baseUrl: string, authToken: string) {
    this.trpc = createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${baseUrl}/api/trpc`,
          headers: {
            authorization: `Bearer ${authToken}`
          }
        })
      ]
    })
  }

  async generatePurchaseOrderPDF(purchaseId: string) {
    return this.trpc.reports.generatePurchaseOrder.mutate({
      purchaseId,
      options: {
        includeLineItems: true,
        compression: true
      }
    })
  }

  async emailPurchaseOrder(purchaseId: string, vendorEmail: string) {
    return this.trpc.email.sendPurchaseOrder.mutate({
      purchaseId,
      emailOptions: {
        to: vendorEmail,
        template: 'formal'
      }
    })
  }

  async generateMonthlyReport(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    return this.trpc.reports.generateDateRangeReport.mutate({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      format: 'detailed',
      filters: {
        includeTrendAnalysis: true,
        includeVendorAnalysis: true
      }
    })
  }
}

// Usage
const client = new ReportsClient('http://localhost:3000', userToken)

// Generate and download PDF
const pdf = await client.generatePurchaseOrderPDF('purchase-123')
window.open(pdf.downloadUrl)

// Email to vendor
const email = await client.emailPurchaseOrder('purchase-123', 'vendor@supplier.com')
console.log(`Email sent with ID: ${email.emailId}`)
```

### React Hooks

```typescript
import { trpc } from '@/utils/trpc'

function PurchaseOrderActions({ purchaseId }: { purchaseId: string }) {
  const generatePDF = trpc.reports.generatePurchaseOrder.useMutation()
  const sendEmail = trpc.email.sendPurchaseOrder.useMutation()

  const handleGeneratePDF = async () => {
    try {
      const result = await generatePDF.mutateAsync({
        purchaseId,
        options: { includeLineItems: true }
      })
      window.open(result.downloadUrl)
    } catch (error) {
      console.error('PDF generation failed:', error)
    }
  }

  const handleEmailVendor = async (vendorEmail: string) => {
    try {
      await sendEmail.mutateAsync({
        purchaseId,
        emailOptions: {
          to: vendorEmail,
          template: 'formal'
        }
      })
      alert('Email sent successfully!')
    } catch (error) {
      console.error('Email sending failed:', error)
    }
  }

  return (
    <div>
      <button
        onClick={handleGeneratePDF}
        disabled={generatePDF.isLoading}
      >
        {generatePDF.isLoading ? 'Generating...' : 'Generate PDF'}
      </button>

      <button
        onClick={() => handleEmailVendor('vendor@supplier.com')}
        disabled={sendEmail.isLoading}
      >
        {sendEmail.isLoading ? 'Sending...' : 'Email Vendor'}
      </button>
    </div>
  )
}
```

## Performance Considerations

### Batching Requests

Use tRPC batching for multiple related requests:

```typescript
const [purchaseOrder, vendorInfo, reportHistory] = await Promise.all([
  trpc.purchase.getById.query({ id: purchaseId }),
  trpc.vendor.getById.query({ id: vendorId }),
  trpc.reports.listReports.query({ filters: { purchaseId } })
])
```

### Caching

Implement client-side caching for frequently accessed data:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  }
})
```

### Pagination

Use pagination for large result sets:

```typescript
const useReportsWithPagination = (pageSize = 20) => {
  const [page, setPage] = useState(0)

  const reports = trpc.reports.listReports.useQuery({
    pagination: {
      limit: pageSize,
      offset: page * pageSize
    }
  })

  return {
    reports: reports.data?.reports || [],
    totalCount: reports.data?.totalCount || 0,
    hasMore: reports.data?.hasMore || false,
    nextPage: () => setPage(p => p + 1),
    prevPage: () => setPage(p => Math.max(0, p - 1)),
    isLoading: reports.isLoading
  }
}
```

For more detailed examples and advanced usage patterns, see the [Integration Guide](./integration-guide.md) and [Performance Optimization Guide](../admin/reports/performance-tuning.md).