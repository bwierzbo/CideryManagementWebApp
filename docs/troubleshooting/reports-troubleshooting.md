# Purchase Order PDF Reports - Troubleshooting Guide

## Overview

This guide provides step-by-step troubleshooting procedures for common issues with the Purchase Order PDF Reports system. Solutions are organized by severity and include both user-level and administrator-level fixes.

## Quick Diagnostics

### System Health Check

Before troubleshooting specific issues, run these quick diagnostics:

```bash
# Check overall system health
curl http://localhost:3000/api/health

# Check specific services
curl http://localhost:3000/api/health/pdf
curl http://localhost:3000/api/health/email
curl http://localhost:3000/api/health/queue
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "pdf": "healthy",
    "email": "healthy",
    "queue": "healthy",
    "storage": "healthy"
  }
}
```

### Common Status Indicators

**Green (Healthy)**: All services operational
**Yellow (Warning)**: Some degraded performance, but functional
**Red (Critical)**: Service failures requiring immediate attention

## PDF Generation Issues

### Problem: PDF Generation Fails Completely

**Symptoms**:
- "PDF generation failed" error message
- No PDF file created
- Error appears immediately when attempting generation

**User-Level Solutions**:

1. **Refresh and Retry**:
   - Refresh the browser page
   - Clear browser cache (Ctrl+F5)
   - Try generating a different purchase order

2. **Check Browser Compatibility**:
   - Use Chrome, Firefox, Safari, or Edge (latest versions)
   - Disable browser extensions temporarily
   - Allow pop-ups for the domain

3. **Verify Purchase Data**:
   - Ensure the purchase order has all required fields filled
   - Check that vendor information is complete
   - Verify line items have quantities and prices

**Administrator Solutions**:

1. **Check PDF Service Status**:
```bash
# Test PDF service
curl -X POST http://localhost:3000/api/reports/test-pdf \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check error logs
tail -f logs/pdf-service.log
```

2. **Verify Dependencies**:
```bash
# Check PDFKit installation
npm list pdfkit

# Test font loading
ls -la assets/fonts/
file assets/fonts/Helvetica.ttf
```

3. **Memory and Resources**:
```bash
# Check available memory
free -h

# Check disk space
df -h

# Monitor Node.js processes
ps aux | grep node
```

### Problem: PDF Generation is Slow

**Symptoms**:
- Generation takes longer than 30 seconds
- Browser shows "loading" indefinitely
- Timeouts during large report generation

**User-Level Solutions**:

1. **Reduce Report Scope**:
   - Generate smaller date ranges
   - Filter by specific vendors or categories
   - Break large reports into smaller segments

2. **Optimize Timing**:
   - Generate reports during off-peak hours
   - Avoid concurrent generation by multiple users
   - Use background generation for large reports

**Administrator Solutions**:

1. **Performance Monitoring**:
```bash
# Check queue depth
redis-cli llen bull:pdf

# Monitor memory usage during generation
watch 'ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -e | head'

# Check concurrent job limits
curl http://localhost:3000/api/admin/metrics/queue
```

2. **Optimize Configuration**:
```typescript
// In packages/api/src/services/pdf/config.ts
export const pdfConfig = {
  compression: true,              // Enable compression
  streamingThreshold: 524288,     // 512KB streaming threshold
  maxConcurrentJobs: 3,           // Reduce concurrent jobs
  memoryLimit: '512M'             // Set memory limit
}
```

3. **Scale Resources**:
```bash
# Increase Redis memory
redis-cli config set maxmemory 1gb

# Monitor CPU usage
top -p $(pgrep -f pdf)
```

### Problem: PDF Format Issues

**Symptoms**:
- Generated PDFs have formatting problems
- Missing fonts or images
- Layout breaks across pages

**User-Level Solutions**:

1. **Try Different Viewers**:
   - Download and open in Adobe Reader
   - Try different browser PDF viewers
   - Check print preview for layout issues

2. **Report Specific Issues**:
   - Note which sections have problems
   - Identify if issue affects all PDFs or specific types
   - Take screenshots of formatting problems

**Administrator Solutions**:

1. **Font Management**:
```bash
# Check font files
ls -la assets/fonts/
file assets/fonts/*.ttf

# Test font loading
pnpm --filter api run test:fonts

# Regenerate font cache
rm -rf assets/fonts/cache/
```

2. **Template Validation**:
```bash
# Validate PDF templates
pnpm --filter api run validate:templates

# Test specific template
pnpm --filter api run test:template purchase-order
```

3. **Image Assets**:
```bash
# Check image files
ls -la assets/images/
file assets/images/logo.*

# Optimize images
pnpm --filter api run optimize:images
```

## Email Delivery Issues

### Problem: Emails Not Sending

**Symptoms**:
- "Email failed to send" error message
- Emails stuck in queue
- No delivery confirmation

**User-Level Solutions**:

1. **Verify Email Addresses**:
   - Check vendor email addresses for typos
   - Ensure email format is valid (user@domain.com)
   - Try sending to a different email address

2. **Check Email Status**:
   - Look for delivery status indicators in the UI
   - Check if email is queued or failed
   - Wait for retry attempts (automatic after 30 seconds)

**Administrator Solutions**:

1. **SMTP Configuration**:
```bash
# Test SMTP connection
pnpm --filter api run test:smtp

# Check SMTP credentials
echo $SMTP_HOST $SMTP_PORT $SMTP_USER
```

2. **Email Queue Status**:
```bash
# Check email queue
redis-cli llen bull:email

# View failed jobs
redis-cli lrange bull:email:failed 0 -1

# Clear stuck jobs
redis-cli del bull:email:stalled
```

3. **Authentication Issues**:
```bash
# Test authentication
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "test@example.com"}]}],
    "from": {"email": "noreply@yourdomain.com"},
    "subject": "Test Email",
    "content": [{"type": "text/plain", "value": "Test"}]
  }'
```

### Problem: Emails Going to Spam

**Symptoms**:
- Vendors report not receiving emails
- Emails found in spam/junk folders
- Low delivery rates

**User-Level Solutions**:

1. **Vendor Communication**:
   - Ask vendors to check spam folders
   - Request whitelisting of sender domain
   - Provide alternative contact methods

**Administrator Solutions**:

1. **Email Authentication**:
```bash
# Check SPF record
dig TXT yourdomain.com | grep spf

# Check DKIM configuration
dig TXT default._domainkey.yourdomain.com

# Check DMARC policy
dig TXT _dmarc.yourdomain.com
```

2. **Sender Reputation**:
```bash
# Check blacklist status
curl -s "http://multirbl.valli.org/lookup/$SMTP_HOST.html"

# Monitor bounce rates
curl http://localhost:3000/api/admin/metrics/email-bounces
```

3. **Email Content**:
```html
<!-- Avoid spam triggers in templates -->
- Remove excessive exclamation points
- Avoid ALL CAPS text
- Include proper unsubscribe links
- Use professional formatting
```

### Problem: Email Attachments Too Large

**Symptoms**:
- "Attachment too large" error message
- Emails fail after PDF generation succeeds
- Inconsistent delivery based on PDF size

**User-Level Solutions**:

1. **Reduce PDF Size**:
   - Generate shorter date range reports
   - Use fewer vendor filters
   - Request compressed PDF format

2. **Alternative Delivery**:
   - Download PDF and send separately
   - Use file sharing service for large reports
   - Split large reports into multiple PDFs

**Administrator Solutions**:

1. **Attachment Limits**:
```typescript
// In packages/api/src/services/email/config.ts
export const emailConfig = {
  attachments: {
    maxSize: 25 * 1024 * 1024,      // 25MB limit
    compressionLevel: 9,             // Maximum compression
    alternativeDelivery: true        // Use cloud storage for large files
  }
}
```

2. **Cloud Storage Integration**:
```typescript
// Alternative delivery for large files
export const cloudStorageConfig = {
  provider: 'aws-s3', // or 'google-cloud', 'azure'
  bucket: 'cidery-reports',
  expirationHours: 72,
  generateLinks: true
}
```

## Performance Issues

### Problem: System Running Slowly

**Symptoms**:
- All operations take longer than normal
- Browser becomes unresponsive
- Multiple users experiencing delays

**User-Level Solutions**:

1. **Reduce Load**:
   - Limit concurrent report generation
   - Generate reports during off-peak hours
   - Close unnecessary browser tabs

2. **Clear Cache**:
   - Clear browser cache and cookies
   - Restart browser
   - Try incognito/private browsing mode

**Administrator Solutions**:

1. **Resource Monitoring**:
```bash
# Check system resources
htop

# Monitor database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory usage
redis-cli info memory
```

2. **Performance Optimization**:
```bash
# Restart services
pnpm --filter api run restart
pnpm --filter worker run restart

# Clear all caches
redis-cli flushdb

# Optimize database
psql -c "VACUUM ANALYZE;"
```

3. **Scale Resources**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Add more worker processes
export WORKER_CONCURRENCY=8
```

### Problem: High Memory Usage

**Symptoms**:
- System running out of memory
- "Out of memory" errors
- Node.js processes crashing

**Administrator Solutions**:

1. **Identify Memory Leaks**:
```bash
# Monitor memory over time
while true; do
  ps -o pid,rss,cmd --sort=-rss | head -10
  sleep 30
done

# Use Node.js profiling
node --inspect packages/api/dist/index.js
```

2. **Optimize PDF Generation**:
```typescript
// In packages/api/src/services/pdf/PdfGenerationService.ts
export class PdfGenerationService {
  async generateReport(data: ReportData) {
    // Use streaming for large reports
    if (data.size > this.streamingThreshold) {
      return this.generateStreaming(data)
    }

    // Batch process large datasets
    const chunks = this.chunkData(data, 100)
    for (const chunk of chunks) {
      await this.processChunk(chunk)
      // Force garbage collection
      if (global.gc) global.gc()
    }
  }
}
```

3. **Memory Limits**:
```typescript
// Set memory limits for background jobs
export const jobConfig = {
  pdf: {
    maxMemory: '512M',
    timeout: 300000, // 5 minutes
    cleanup: true
  }
}
```

## Data and Integration Issues

### Problem: Missing Purchase Data

**Symptoms**:
- PDFs generate but have missing information
- Empty sections in reports
- "No data available" messages

**User-Level Solutions**:

1. **Verify Data Entry**:
   - Check that purchase orders have all required fields
   - Ensure vendor information is complete
   - Verify line items have descriptions and prices

2. **Check Filters**:
   - Remove restrictive filters
   - Expand date ranges
   - Check vendor selection settings

**Administrator Solutions**:

1. **Database Integrity**:
```sql
-- Check for missing vendor data
SELECT p.id, p.vendor_id, v.name
FROM purchases p
LEFT JOIN vendors v ON p.vendor_id = v.id
WHERE v.id IS NULL;

-- Check for incomplete line items
SELECT p.id, COUNT(pl.id) as line_count
FROM purchases p
LEFT JOIN purchase_lines pl ON p.id = pl.purchase_id
GROUP BY p.id
HAVING COUNT(pl.id) = 0;
```

2. **Data Migration**:
```bash
# Re-run data migrations
pnpm db:migrate

# Seed missing reference data
pnpm db:seed

# Validate data integrity
pnpm --filter db run validate
```

### Problem: Vendor Information Errors

**Symptoms**:
- Wrong vendor names or addresses in PDFs
- Outdated contact information
- Inconsistent vendor data

**User-Level Solutions**:

1. **Update Vendor Records**:
   - Go to Vendor Management page
   - Update contact information
   - Verify email addresses

2. **Report Data Issues**:
   - Document specific vendors with problems
   - Note what information is incorrect
   - Provide correct information to administrators

**Administrator Solutions**:

1. **Data Cleanup**:
```sql
-- Find duplicate vendors
SELECT name, COUNT(*)
FROM vendors
GROUP BY name
HAVING COUNT(*) > 1;

-- Update vendor information
UPDATE vendors
SET email = 'correct@email.com'
WHERE id = 'vendor-id';
```

2. **Data Validation**:
```typescript
// Add validation rules
export const vendorValidation = {
  email: {
    required: true,
    format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    required: false,
    format: /^\+?[\d\s\-\(\)]+$/
  },
  address: {
    required: true,
    minLength: 10
  }
}
```

## Security and Access Issues

### Problem: Permission Denied Errors

**Symptoms**:
- "Access denied" error messages
- Cannot generate or view reports
- Missing UI elements or buttons

**User-Level Solutions**:

1. **Check Login Status**:
   - Ensure you're logged in
   - Try logging out and back in
   - Check session timeout settings

2. **Request Access**:
   - Contact your administrator
   - Verify your role and permissions
   - Request appropriate access levels

**Administrator Solutions**:

1. **Role Management**:
```sql
-- Check user roles
SELECT u.email, ur.role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id;

-- Grant report access
INSERT INTO user_roles (user_id, role_name)
VALUES ('user-id', 'REPORT_VIEWER');
```

2. **Permission Configuration**:
```typescript
// In packages/lib/src/rbac/roles.ts
export const reportPermissions = {
  ADMIN: ['*'],
  MANAGER: ['generate_reports', 'email_vendors'],
  OPERATOR: ['generate_purchase_orders'],
  VIEWER: ['view_reports']
}
```

### Problem: Authentication Failures

**Symptoms**:
- Cannot log in to system
- Session expires frequently
- Authentication errors in logs

**Administrator Solutions**:

1. **Session Configuration**:
```bash
# Check session settings
echo $NEXTAUTH_URL
echo $NEXTAUTH_SECRET

# Verify JWT configuration
pnpm --filter api run test:auth
```

2. **Database Sessions**:
```sql
-- Check active sessions
SELECT * FROM sessions WHERE expires > NOW();

-- Clean expired sessions
DELETE FROM sessions WHERE expires < NOW();
```

## Emergency Procedures

### System Down - Complete Outage

**Immediate Actions**:

1. **Assess Scope**:
```bash
# Check all services
systemctl status postgresql
systemctl status redis
systemctl status nginx
ps aux | grep node
```

2. **Emergency Recovery**:
```bash
# Restart all services
sudo systemctl restart postgresql redis nginx

# Restart application
pnpm --filter api run restart
pnpm --filter worker run restart
pnpm --filter web run restart
```

3. **Verify Recovery**:
```bash
# Test critical endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/auth/session
```

### Data Corruption

**If PDF generation produces corrupted files**:

1. **Immediate Isolation**:
```bash
# Stop PDF generation
redis-cli del bull:pdf

# Clear corrupted cache
rm -rf temp/pdfs/*
redis-cli flushdb
```

2. **Recovery Steps**:
```bash
# Restore from backup
cp -r assets/backup/* assets/

# Regenerate templates
pnpm --filter api run regenerate:templates

# Test with known good data
pnpm --filter api run test:pdf-generation
```

### Security Breach

**If suspicious activity detected**:

1. **Immediate Response**:
```bash
# Block access
iptables -A INPUT -p tcp --dport 3000 -j REJECT

# Audit logs
grep -r "suspicious" logs/
tail -f logs/audit.log
```

2. **Investigation**:
```bash
# Check for unauthorized access
grep "unauthorized" logs/audit.log

# Review recent changes
git log --since="24 hours ago" --oneline
```

3. **Recovery**:
```bash
# Change credentials
# Update environment variables
# Restart with new configuration
```

## Getting Help

### Self-Service Resources

1. **Documentation**:
   - [User Guide](../user/reports/user-guide.md)
   - [Administrator Guide](../admin/reports/admin-guide.md)
   - [API Documentation](../api/reports.md)

2. **Diagnostic Tools**:
```bash
# Generate system report
pnpm --filter api run diagnostic:full

# Run health checks
pnpm test:health

# Performance benchmark
pnpm --filter api run benchmark
```

### Support Escalation

**Level 1 - User Issues**:
- Email: support@ciderymanagement.com
- Phone: 1-800-CIDERY-1
- Chat: Available 9 AM - 5 PM EST

**Level 2 - Technical Issues**:
- Email: technical@ciderymanagement.com
- Emergency: 1-800-CIDERY-911
- Slack: #technical-support

**Level 3 - System Critical**:
- Emergency hotline: 1-800-CIDERY-911
- Escalation manager: escalation@ciderymanagement.com
- On-call engineer: Available 24/7

### Information to Provide

When contacting support, include:

1. **System Information**:
   - Operating system and version
   - Browser type and version
   - Node.js and npm versions
   - Database and Redis versions

2. **Error Details**:
   - Exact error messages
   - Steps to reproduce the issue
   - Screenshots if applicable
   - Relevant log entries

3. **Impact Assessment**:
   - Number of users affected
   - Business impact severity
   - Urgency level
   - Workaround availability

4. **Environment Details**:
   - Production, staging, or development
   - Recent changes or deployments
   - System load and resource usage
   - Network configuration

This troubleshooting guide should help resolve most common issues. For complex problems or system-wide outages, always escalate to the appropriate support level immediately.