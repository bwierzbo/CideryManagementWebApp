---
created: 2025-09-13T04:03:23Z
last_updated: 2025-09-17T02:50:09Z
version: 1.1
author: Claude Code PM System
---

# Product Context

## Target Users

### Primary Users
- **Cidery Operators**: Day-to-day production staff managing fermentation, transfers, and quality measurements
- **Production Managers**: Supervisors overseeing production workflows and inventory management
- **Cidery Owners**: Business owners tracking costs, yields, and overall production metrics

### User Personas

#### Sarah - Production Operator
- **Role**: Handles daily fermentation monitoring and batch transfers
- **Needs**: Quick data entry, batch status visibility, measurement tracking
- **Pain Points**: Complex Excel spreadsheets, manual calculation errors
- **Usage**: Multiple daily interactions during production activities

#### Mike - Production Manager
- **Role**: Oversees production planning and inventory management
- **Needs**: Production reports, batch planning, inventory visibility
- **Pain Points**: Disconnected data sources, manual report generation
- **Usage**: Daily planning and weekly reporting activities

#### Jennifer - Cidery Owner
- **Role**: Business oversight and financial management
- **Needs**: COGS analysis, profitability reports, production efficiency metrics
- **Pain Points**: Lack of real-time cost visibility, manual financial analysis
- **Usage**: Weekly business reviews and monthly financial analysis

## Core Functionality

### Production Workflow Management
- **Vendor Management**: Track apple suppliers and raw material sources
- **Purchase Tracking**: Record procurement with detailed line items and costs
- **Press Operations**: Manage apple pressing runs and juice lot creation
- **Fermentation Control**: Monitor batch fermentation in vessels with measurements
- **Transfer Management**: Track liquid transfers between vessels and stages
- **Blending Operations**: Create custom blends from multiple batches
- **Packaging Runs**: Record bottling/canning operations and finished goods
- **Inventory Tracking**: Maintain real-time inventory levels and movements

### Cost Analysis & Reporting
- **COGS Calculation**: Detailed cost-of-goods-sold analysis per batch
- **Cost Allocation**: Track raw material costs through production process
- **Yield Analysis**: Calculate yields at each production stage
- **Profitability Reports**: Batch-level and product-level profit analysis
- **Export Capabilities**: CSV and PDF report generation for external use

### Quality Management
- **Measurement Tracking**: ABV, pH, specific gravity, and other quality metrics
- **Batch Monitoring**: Real-time fermentation status and alerts
- **Quality Trends**: Historical quality data analysis and trending

## Use Cases

### Daily Operations

#### Morning Production Check
1. **User**: Sarah (Operator)
2. **Scenario**: Starting daily production activities
3. **Actions**:
   - Check active batch statuses
   - Review pending measurements
   - Plan day's transfers and activities
4. **Success**: Clear visibility of day's tasks and priorities

#### Batch Measurement Recording
1. **User**: Sarah (Operator)
2. **Scenario**: Recording quality measurements during fermentation
3. **Actions**:
   - Select batch and vessel
   - Enter ABV, pH, temperature readings
   - Add notes about batch condition
4. **Success**: Measurements saved with timestamp and audit trail

### Weekly Planning

#### Production Planning
1. **User**: Mike (Production Manager)
2. **Scenario**: Planning next week's production activities
3. **Actions**:
   - Review inventory levels
   - Plan press runs based on apple availability
   - Schedule vessel cleaning and preparation
4. **Success**: Optimized production schedule with resource allocation

#### Inventory Review
1. **User**: Mike (Production Manager)
2. **Scenario**: Weekly inventory assessment
3. **Actions**:
   - Review finished goods inventory
   - Identify slow-moving products
   - Plan packaging runs based on demand
4. **Success**: Balanced inventory with minimal waste

### Monthly Business Review

#### COGS Analysis
1. **User**: Jennifer (Cidery Owner)
2. **Scenario**: Monthly financial review
3. **Actions**:
   - Generate COGS reports by batch
   - Compare actual vs. projected costs
   - Identify cost optimization opportunities
4. **Success**: Clear understanding of production profitability

#### Performance Metrics
1. **User**: Jennifer (Cidery Owner)
2. **Scenario**: Business performance evaluation
3. **Actions**:
   - Review yield performance across batches
   - Analyze production efficiency trends
   - Export data for external financial analysis
4. **Success**: Data-driven business decisions with accurate metrics

### Seasonal Operations

#### Harvest Season Setup
1. **User**: Mike (Production Manager)
2. **Scenario**: Preparing for apple harvest season
3. **Actions**:
   - Set up vendor agreements and pricing
   - Plan press run schedule
   - Prepare vessel allocation strategy
4. **Success**: Smooth harvest processing with optimized resource utilization

#### Year-End Reporting
1. **User**: Jennifer (Cidery Owner)
2. **Scenario**: Annual business analysis and tax preparation
3. **Actions**:
   - Generate comprehensive cost reports
   - Export financial data for accounting
   - Analyze year-over-year performance trends
4. **Success**: Complete financial records for business planning

## Business Context

### Industry Background
- **Market**: Small to medium-sized cideries replacing manual Excel-based tracking
- **Compliance**: FDA food safety regulations and state alcohol regulations
- **Seasonality**: Apple harvest drives production cycles
- **Scale**: Single-facility operations with growth potential

### Business Value Proposition
- **Efficiency**: Eliminate manual data entry and calculation errors
- **Visibility**: Real-time production and cost visibility
- **Accuracy**: Precise COGS calculation for pricing decisions
- **Compliance**: Audit trail for regulatory requirements
- **Scalability**: System grows with business expansion

### Key Performance Indicators
- **Production Metrics**: Yield per press run, fermentation success rate
- **Financial Metrics**: COGS per batch, profit margins by product
- **Operational Metrics**: Time to complete production cycles
- **Quality Metrics**: Consistency of quality measurements across batches

## User Experience Requirements

### Usability Principles
- **Heavy Autofill**: Smart defaults and suggestions to minimize data entry
- **Context Awareness**: System understands production workflow context
- **Error Prevention**: Validation rules prevent common mistakes
- **Progressive Disclosure**: Advanced features available but not cluttering
- **Mobile Friendly**: Usable on tablets and phones in production environment

### Workflow Integration
- **Production-First**: Interface designed around actual cidery workflows
- **Batch-Centric**: All operations organized around batch lifecycle
- **Time-Sensitive**: Quick access to frequently used functions
- **Audit-Ready**: All changes tracked for regulatory compliance

### Performance Requirements
- **Always Online**: Cloud-hosted with reliable internet connectivity
- **Real-Time Updates**: Immediate visibility of changes across users
- **Fast Response**: Sub-second response times for common operations
- **Reliable Export**: Consistent report generation for business use