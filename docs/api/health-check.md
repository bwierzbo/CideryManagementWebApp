# Health Check API Documentation

The Health Check API provides endpoints for system status verification, database connectivity testing, and performance monitoring in the Cidery Management System.

## Overview

All health check endpoints are publicly accessible (no authentication required) and designed for system monitoring, load balancers, and operational health verification.

## Endpoints

### 1. Basic Health Check (`/api/health/ping`)

**Purpose**: Fast liveness check for basic operational status.

**Response Time Target**: <50ms

**Response Format**:
```json
{
  "status": "healthy",
  "message": "API is operational",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600.45
}
```

**Use Cases**:
- Load balancer health checks
- Container orchestration liveness probes
- Basic monitoring systems

---

### 2. System Resource Check (`/api/health/system`)

**Purpose**: Monitor Node.js process and system resource usage.

**Response Time Target**: <100ms

**Response Format**:
```json
{
  "status": "healthy",
  "system": {
    "uptime_seconds": 3600,
    "memory": {
      "rss": 256.75,
      "heapTotal": 128.50,
      "heapUsed": 89.25,
      "external": 12.10,
      "heap_utilization_percent": 69
    },
    "cpu": {
      "user_microseconds": 1234567,
      "system_microseconds": 234567
    },
    "node_version": "v18.17.0",
    "platform": "darwin",
    "arch": "x64"
  },
  "timestamp": "2024-01-15T10:30:45.123Z",
  "response_time_ms": 15
}
```

**Memory Metrics**:
- `rss`: Resident Set Size (total memory used by process)
- `heapTotal`: Total heap memory allocated by V8
- `heapUsed`: Heap memory currently in use
- `external`: Memory used by C++ objects bound to JavaScript
- `heap_utilization_percent`: Percentage of heap currently used

---

### 3. Database Health Check (`/api/health/database`)

**Purpose**: Comprehensive database connectivity and performance testing.

**Response Time Target**: <100ms

**Response Format**:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "version": "PostgreSQL 15.4 on x86_64-pc-linux-gnu",
    "connectivity_ms": 25,
    "table_query_ms": 35,
    "pool_status": {
      "total_connections": 10,
      "active_connections": 2,
      "idle_connections": 8
    },
    "test_results": {
      "basic_query": true,
      "table_access": true,
      "records": {
        "vendor_count": 5,
        "user_count": 3
      }
    }
  },
  "timestamp": "2024-01-15T10:30:45.123Z",
  "response_time_ms": 67
}
```

**Database Tests Performed**:
1. Basic connectivity (`SELECT 1`)
2. Version retrieval
3. Connection pool status (when available)
4. Table access verification with record counts

**Unhealthy Response**:
```json
{
  "status": "unhealthy",
  "database": {
    "connected": false,
    "error": "Connection refused",
    "response_time_ms": 5000
  },
  "timestamp": "2024-01-15T10:30:45.123Z",
  "response_time_ms": 5000
}
```

---

### 4. Comprehensive Status Check (`/api/health/status`)

**Purpose**: Combined system and database health check for overall status.

**Response Time Target**: <100ms

**Response Format**:
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "connected": true,
      "version": "PostgreSQL 15.4",
      "response_time_ms": 25
    },
    "system": {
      "status": "healthy",
      "uptime_seconds": 3600,
      "heap_utilization_percent": 69,
      "memory_mb": 89.25
    }
  },
  "timestamp": "2024-01-15T10:30:45.123Z",
  "response_time_ms": 45,
  "api_version": "0.1.0"
}
```

**Overall Status Logic**:
- `healthy`: All subsystem checks pass
- `unhealthy`: Any subsystem check fails

---

### 5. Detailed Diagnostics (`/api/health/diagnostics`)

**Purpose**: Extensive system information for debugging and troubleshooting.

**Response Time Target**: <500ms (acceptable for debugging use)

**Response Format**:
```json
{
  "status": "healthy",
  "diagnostics": {
    "timestamp": "2024-01-15T10:30:45.123Z",
    "environment": {
      "node_version": "v18.17.0",
      "platform": "darwin",
      "arch": "x64",
      "pid": 12345,
      "uptime_seconds": 3600
    },
    "memory": {
      "rss": 269221888,
      "heapTotal": 134742016,
      "heapUsed": 93571856,
      "external": 12694752,
      "arrayBuffers": 123456
    },
    "cpu": {
      "user_microseconds": 1234567,
      "system_microseconds": 234567
    },
    "database": {
      "url_configured": true,
      "connection_string_prefix": "postgresql://user:***...",
      "connectivity_test_ms": 25,
      "status": "healthy",
      "info": {
        "database_name": "cidery_management",
        "current_user": "app_user",
        "version": "PostgreSQL 15.4"
      },
      "tables": [
        {
          "schemaname": "public",
          "tablename": "users",
          "hasindexes": true,
          "hasrules": false,
          "hastriggers": false
        }
      ]
    }
  },
  "response_time_ms": 125
}
```

## Usage Examples

### Load Balancer Configuration

```nginx
# Nginx upstream health check
upstream api_backend {
    server api1.example.com:3000;
    server api2.example.com:3000;
}

location /health {
    access_log off;
    proxy_pass http://api_backend/api/health/ping;
    proxy_connect_timeout 1s;
    proxy_read_timeout 1s;
}
```

### Docker Healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/ping || exit 1
```

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /api/health/ping
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/status
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 5
  failureThreshold: 2
```

### Monitoring Script

```bash
#!/bin/bash
# Simple monitoring script

check_health() {
  local endpoint=$1
  local response=$(curl -s -w "%{http_code}" http://localhost:3000/api/health/$endpoint)
  local http_code=${response: -3}
  local body=${response%???}

  if [ "$http_code" -eq 200 ]; then
    local status=$(echo "$body" | jq -r '.status')
    echo "$endpoint: $status (HTTP $http_code)"
  else
    echo "$endpoint: FAILED (HTTP $http_code)"
  fi
}

check_health "ping"
check_health "system"
check_health "database"
check_health "status"
```

## Error Handling

All endpoints implement graceful error handling:

1. **Network/Connection Errors**: Return appropriate HTTP status codes
2. **Database Failures**: Mark database checks as unhealthy but continue serving responses
3. **System Resource Issues**: Continue monitoring with available metrics
4. **Partial Failures**: Individual check failures don't prevent overall response

## Performance Characteristics

| Endpoint | Target Response Time | Typical Response Time | Max Acceptable |
|----------|--------------------|--------------------|---------------|
| ping | <50ms | 5-15ms | 100ms |
| system | <100ms | 10-30ms | 200ms |
| database | <100ms | 25-75ms | 500ms |
| status | <100ms | 30-80ms | 200ms |
| diagnostics | <500ms | 100-300ms | 1000ms |

## Security Considerations

- **No Authentication Required**: Endpoints are publicly accessible for system monitoring
- **Information Disclosure**: Diagnostic endpoint may reveal system information; consider restricting in production
- **Rate Limiting**: Consider implementing rate limiting to prevent abuse
- **Network Security**: Restrict access at network/firewall level if needed

## Monitoring Integration

The health check API integrates with common monitoring solutions:

- **Prometheus**: Metrics can be scraped from JSON responses
- **DataDog**: Custom checks can parse JSON responses
- **New Relic**: Synthetic monitoring can use these endpoints
- **AWS ALB**: Health checks can target these endpoints
- **CloudFlare**: Load balancer health checks supported