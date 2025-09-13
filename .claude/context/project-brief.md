---
created: 2025-09-13T04:03:23Z
last_updated: 2025-09-13T04:03:23Z
version: 1.0
author: Claude Code PM System
---

# Project Brief

## Project Scope

### What It Does
**Cidery Management MVP** is a web application that replaces Excel spreadsheets for tracking the complete cidery production workflow from vendor purchases through fermentation to packaging and inventory management.

### Core Problem Solved
Small to medium cideries currently rely on complex Excel spreadsheets to track production costs, yields, and inventory. This manual approach leads to:
- Calculation errors in cost-of-goods-sold (COGS) analysis
- Time-consuming data entry and report generation
- Lack of real-time visibility into production status
- Difficulty in maintaining audit trails for compliance
- Inability to scale operations efficiently

### Target Market
- **Primary**: Small to medium-sized cideries (1-50,000 gallons annual production)
- **Secondary**: Craft beverage producers with similar production workflows
- **Geographic**: North American cideries with regulatory compliance requirements

## Key Objectives

### Business Goals
1. **Replace Excel**: Eliminate manual spreadsheet-based production tracking
2. **Improve Accuracy**: Provide precise COGS calculation and cost allocation
3. **Increase Efficiency**: Reduce time spent on data entry and report generation
4. **Enable Growth**: Support business scaling without operational complexity
5. **Ensure Compliance**: Maintain audit trails for regulatory requirements

### Success Criteria
- **Adoption**: Cidery staff successfully migrate from Excel to web application
- **Accuracy**: COGS calculations match or exceed Excel-based analysis precision
- **Efficiency**: 50% reduction in time spent on production data management
- **Reliability**: 99.9% uptime for cloud-hosted application
- **Usability**: Production staff can use system with minimal training

## Project Deliverables

### MVP Features (Phase 1)
1. **Vendor Management**: Add, edit, and track apple suppliers
2. **Purchase Tracking**: Record vendor purchases with detailed line items
3. **Press Run Management**: Track apple pressing operations and juice lots
4. **Fermentation Tracking**: Monitor batches in vessels with quality measurements
5. **Basic Inventory**: Track finished goods and movements
6. **COGS Reporting**: Generate cost analysis reports (CSV and PDF)
7. **User Authentication**: Role-based access control (Admin, Operator, Viewer)
8. **Audit Logging**: Complete change history for all operations

### Technical Deliverables
1. **Web Application**: Next.js frontend with responsive design
2. **API Layer**: tRPC-based backend with type-safe endpoints
3. **Database**: PostgreSQL with Drizzle ORM schema
4. **Authentication**: NextAuth.js with role-based permissions
5. **Hosting**: Vercel deployment with cloud database
6. **Documentation**: Setup guides and user documentation

## Strategic Context

### Why This Project Exists
The craft cidery industry is experiencing significant growth, but operational tools haven't kept pace. Most cideries outgrow their Excel-based systems but can't justify expensive enterprise solutions designed for large-scale operations.

This project fills the gap by providing a purpose-built solution that:
- Understands cidery-specific workflows and terminology
- Scales appropriately for small to medium operations
- Provides enterprise-grade features at accessible pricing
- Integrates seamlessly with existing business processes

### Market Opportunity
- **Market Size**: 500+ cideries in North America with growth trajectory
- **Competitive Gap**: No specialized cidery management solutions in mid-market
- **Technology Advantage**: Modern web stack provides superior user experience
- **Business Model**: SaaS subscription with predictable revenue streams

## Implementation Strategy

### Development Approach
- **MVP-First**: Deliver core functionality quickly for early feedback
- **User-Centered**: Design based on actual cidery workflows and pain points
- **Quality-Focused**: Comprehensive testing and error handling
- **Scalable Architecture**: Design for growth from single facility to multiple locations

### Technology Rationale
- **TypeScript**: End-to-end type safety reduces bugs and improves maintainability
- **Next.js**: Best-in-class developer experience with production-ready performance
- **tRPC**: Type-safe API layer eliminates common integration issues
- **PostgreSQL**: Proven reliability for transactional data with complex relationships
- **Cloud-First**: Eliminates on-premise infrastructure complexity

### Risk Mitigation
- **Technical Risk**: Proven technology stack with extensive community support
- **Market Risk**: Direct cidery partnership for requirements validation
- **Operational Risk**: Cloud hosting provides reliability and scalability
- **Competitive Risk**: First-mover advantage in specialized cidery market

## Constraints & Assumptions

### Technical Constraints
- **Single Facility**: MVP focuses on single-location operations
- **Cloud-Only**: No offline mode or on-premise deployment
- **Web-First**: Mobile-responsive but not native mobile application
- **PostgreSQL**: Single database technology for simplicity

### Business Constraints
- **Budget**: Bootstrap development with minimal external funding
- **Timeline**: 3-6 month development timeline for MVP
- **Resources**: Small development team with cidery domain expertise
- **Compliance**: Must meet FDA food safety and state alcohol regulations

### Assumptions
- **Internet Connectivity**: Cideries have reliable internet for cloud application
- **User Adoption**: Staff willing to transition from Excel-based workflows
- **Market Demand**: Sufficient cideries seeking operational improvements
- **Technology Acceptance**: Users comfortable with modern web applications

## Success Metrics

### Development Milestones
- **Month 1**: Core infrastructure and authentication complete
- **Month 2**: Vendor and purchase management functional
- **Month 3**: Production workflow (press, fermentation, packaging) implemented
- **Month 4**: COGS reporting and export functionality
- **Month 5**: Beta testing with partner cidery
- **Month 6**: Production deployment and first customer onboarding

### Business Metrics
- **User Engagement**: Daily active users during production season
- **Feature Adoption**: Usage rates for core workflow features
- **Data Quality**: Accuracy of COGS calculations vs. manual methods
- **Customer Satisfaction**: User feedback and support ticket volume
- **Business Growth**: Customer acquisition and revenue generation

## Long-Term Vision Alignment
This MVP establishes the foundation for a comprehensive cidery management platform that can expand to include:
- Multi-facility operations
- Supply chain optimization
- Sales and distribution management
- Advanced analytics and forecasting
- Integration with accounting and compliance systems

The initial focus on production tracking and COGS analysis addresses the most critical pain points while building toward a complete business management solution.