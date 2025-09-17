---
name: cellartankfunctionality
description: Comprehensive cellar tank and vessel management system for fermentation monitoring, transfers, and quality control
status: backlog
created: 2025-09-17T05:05:31Z
---

# PRD: Cellar Tank Functionality

## Executive Summary

The Cellar Tank Functionality provides comprehensive vessel management capabilities for cidery operations, enabling production staff to monitor fermentation, track batch progress, record quality measurements, and manage transfers between vessels. This system replaces complex Excel tracking with real-time digital management of fermentation tanks, conditioning vessels, and storage containers.

**Value Proposition**: Streamline fermentation monitoring and vessel management to improve production efficiency, reduce manual errors, and provide real-time visibility into batch progress and tank utilization.

## Problem Statement

### Current Pain Points

Small to medium cideries currently struggle with fermentation and vessel management due to:

- **Manual Tracking**: Excel spreadsheets for tank contents, batch status, and measurement records
- **Visibility Gaps**: No real-time view of vessel availability, batch progress, or quality metrics
- **Error-Prone Data Entry**: Manual calculation of volumes, ABV, and transfer quantities
- **Poor Transfer Management**: Difficulty tracking liquid movements between vessels
- **Inefficient Scheduling**: Manual coordination of vessel cleaning, maintenance, and batch planning
- **Quality Control Issues**: Inconsistent measurement recording and trend analysis

### Why Now

- **Scalability Needs**: Manual tracking becomes unmanageable as production volume increases
- **Quality Standards**: Regulatory compliance requires consistent measurement documentation
- **Operational Efficiency**: Real-time vessel status enables better production planning
- **Cost Control**: Accurate volume tracking essential for COGS calculation

## User Stories

### Primary User Personas

#### Sarah - Production Operator
**Role**: Daily fermentation monitoring and batch management
**Goals**: Quick status checks, measurement entry, transfer coordination
**Pain Points**: Time-consuming Excel updates, calculation errors
**Usage**: Multiple daily interactions for routine tasks

#### Mike - Production Manager
**Role**: Production planning and resource optimization
**Goals**: Vessel utilization, batch scheduling, capacity planning
**Pain Points**: Lack of real-time visibility, manual reporting
**Usage**: Daily planning and weekly optimization

#### Jennifer - Cidery Owner
**Role**: Quality oversight and production metrics
**Goals**: Quality trends, production efficiency, cost tracking
**Pain Points**: Limited visibility into operations, manual analysis
**Usage**: Weekly reviews and monthly assessments

### Core User Journeys

#### Daily Production Monitoring
**Actor**: Sarah (Production Operator)
**Scenario**: Morning rounds to check fermentation status
**Steps**:
1. Access cellar dashboard showing all active vessels
2. Review overnight temperature and fermentation activity
3. Identify batches requiring attention or measurements
4. Plan day's activities based on batch status
**Success Criteria**: Clear prioritized task list with vessel-specific actions

#### Quality Measurement Recording
**Actor**: Sarah (Production Operator)
**Scenario**: Recording as-needed fermentation measurements
**Steps**:
1. Select tank from mobile interface
2. Use "Add Measurement" action to record optional values: Temp(C), SH, pH, %ABV
3. Add notes about juice condition and observations
4. System saves measurement with timestamp and user attribution
5. View historical measurement trends for the juice batch in this tank
**Success Criteria**: Flexible measurement recording with complete juice tracking history

#### Additive Management
**Actor**: Sarah (Production Operator)
**Scenario**: Adding yeast to fermenting tank
**Steps**:
1. Select tank containing juice (any status: fermenting, storing, aging)
2. Use "Add Additive" action to record addition
3. Select additive type (yeast, acids, nutrients, enzymes, sulfites, clarifying agents)
4. Enter amount added with units (grams, ml, ppm)
5. Add notes about timing and purpose
**Success Criteria**: Complete additive history tracked with quantities and timing

#### Tank Status Management
**Actor**: Sarah (Production Operator)
**Scenario**: Managing tank lifecycle from empty to production to cleaning
**Steps**:
1. New tank starts with "empty" status
2. When juice is added from press run, status automatically changes to "fermenting"
3. User can manually change status from "fermenting" to "storing" or "aging" as needed
4. Users can add more juice at any point during fermenting/storing/aging
5. When all juice is transferred out, tank automatically returns to "empty" status
6. User can manually set "empty" tank to "cleaning" or "maintenance" status
7. Tank status displays with color-coded visual indicators throughout interface
**Success Criteria**: Seamless status workflow with automatic updates and manual override flexibility

#### Transfer Operations
**Actor**: Sarah (Production Operator)
**Scenario**: Moving juice from fermenter to conditioning tank
**Steps**:
1. Initiate transfer workflow in system
2. Select source tank, destination tank, and transfer volume
3. Record transfer details and any quality observations
4. System updates tank contents and juice batch location
5. If all juice is transferred out, source tank automatically changes to "empty" status
6. Destination tank automatically changes to "fermenting" status when juice is added
7. Generate transfer documentation for records
**Success Criteria**: Accurate volume tracking with automatic status management

#### Vessel Scheduling
**Actor**: Mike (Production Manager)
**Scenario**: Planning next week's vessel utilization
**Steps**:
1. Review vessel availability calendar
2. Schedule cleaning and maintenance windows
3. Plan batch assignments based on capacity and timeline
4. Coordinate with pressing schedule for juice placement
**Success Criteria**: Optimized vessel utilization with no conflicts

#### Quality Trend Analysis
**Actor**: Jennifer (Cidery Owner)
**Scenario**: Monthly quality review for process improvement
**Steps**:
1. Access quality dashboard with measurement trends
2. Review batch performance across vessel types
3. Identify patterns in fermentation issues or successes
4. Export quality reports for regulatory compliance
**Success Criteria**: Data-driven insights for quality improvement

## Requirements

### Functional Requirements

#### Tank Management
- **FR-001**: Create, edit, and manage tank registry with specifications
  - Tank name, type (fermenter, conditioning, bright tank, storage)
  - Capacity in liters and gallons with unit conversion
  - Material (stainless steel, plastic) and jacketed status
  - Location within facility and maintenance notes
- **FR-002**: Automated tank status management with visual indicators
  - Status options: empty, fermenting, storing, aging, cleaning, maintenance
  - New tanks default to "empty" status
  - Adding juice automatically changes status from "empty" to "fermenting"
  - Transferring all juice out automatically changes status to "empty"
  - Users can manually change status between fermenting/storing/aging/cleaning/maintenance
  - Color-coded status indicators with intuitive icons
- **FR-003**: Tank action system with mobile optimization
  - "Add Measurement" action for optional Temp(C), SH, pH, %ABV recording
  - "Add Additive" action for yeast, acids, nutrients, enzymes, sulfites, clarifying agents
  - "Change Status" action for manual status updates
  - All actions timestamp and track user attribution
- **FR-004**: Volume and capacity tracking
  - Real-time volume tracking from juice additions and transfers
  - Available capacity calculations and overfill warnings
  - Source tracking from press runs (manual assignment)
  - Current fill level percentages and visual indicators

#### Juice Batch Tracking
- **FR-005**: Assign juice batches to tanks with complete traceability
  - Batch number assignment and QR code generation
  - Source juice lot tracking from apple press
  - Target completion dates and fermentation timeline
- **FR-006**: Juice batch status management throughout fermentation
  - Planned, active, completed, cancelled status workflow
  - Automated status updates based on measurements
  - Batch transfer history and current location
- **FR-007**: Juice batch composition and additive tracking
  - Juice lot components and percentages
  - Additive tracking (nutrients, enzymes, acids)
  - Blend component management for complex batches

#### Quality Measurements & Additive Management
- **FR-008**: Flexible measurement recording system
  - Optional field recording: Temp(C), SH, pH, %ABV (all optional)
  - As-needed measurement frequency
  - Free-form entry with timestamp and user tracking
  - Historical measurement tracking tied to juice batch, not just tank
- **FR-009**: Comprehensive additive tracking
  - Record additions of yeast, acids, nutrients, enzymes, sulfites, clarifying agents
  - Track amounts added with units (grams, ml, ppm)
  - Timestamp all additions with user attribution
  - Available for tanks with juice (any status: fermenting, storing, aging)
- **FR-010**: Historical trend analysis
  - Measurement trends for individual juice batches across tank transfers
  - Additive history timeline for each juice batch
  - Visual charts showing fermentation progress over time
  - Notification routing to responsible staff
  - Escalation procedures for quality issues

#### Transfer Management
- **FR-011**: Automated transfer workflow with status management
  - Source and destination tank selection with capacity validation
  - Volume entry with automatic tank status updates
  - When all juice transferred out: source tank automatically becomes "empty"
  - When juice added to destination: tank automatically becomes "fermenting"
  - Transfer reason and quality notes recording
- **FR-012**: Transfer documentation and volume tracking
  - Digital transfer sheets with user attribution
  - Real-time tank content updates and juice batch location tracking
  - Historical transfer audit trail with complete volume history
  - Integration with existing press run to tank assignment (manual)

#### Planning and Scheduling
- **FR-013**: Tank availability calendar
  - Visual scheduling interface with drag-and-drop
  - Capacity planning and conflict detection
  - Integration with apple press scheduling
- **FR-014**: Maintenance and cleaning status tracking
  - Scheduled maintenance reminders
  - Cleaning protocol checklists
  - Sanitization verification workflows
- **FR-015**: Production forecasting and capacity planning
  - Capacity utilization projections
  - Batch completion timeline estimates
  - Bottleneck identification and optimization

### Non-Functional Requirements

#### Performance
- **NFR-001**: Dashboard loads within 2 seconds with 100+ vessels
- **NFR-002**: Mobile measurement entry works offline with sync
- **NFR-003**: System supports 500+ concurrent measurements daily

#### Scalability
- **NFR-004**: Database design supports 1000+ vessels and 10,000+ batches
- **NFR-005**: Architecture scales to multiple facility locations
- **NFR-006**: API design enables third-party integrations

#### Security & Compliance
- **NFR-007**: Role-based access control for all vessel operations
- **NFR-008**: Audit trail for all measurements and transfers
- **NFR-009**: Data retention policies for regulatory compliance

#### Usability
- **NFR-010**: Mobile-first design for production floor usage
- **NFR-011**: Barcode/QR code scanning for vessel identification
- **NFR-012**: Voice input support for hands-free operation

## Success Criteria

### Primary Metrics
- **Time Reduction**: 75% reduction in time spent on vessel status tracking
- **Error Reduction**: 90% reduction in volume calculation errors
- **Visibility Improvement**: 100% real-time vessel status accuracy
- **Quality Compliance**: 100% measurement traceability for audits

### Secondary Metrics
- **User Adoption**: 95% of production staff actively using mobile interface
- **Data Quality**: 99% complete measurement records
- **Efficiency Gains**: 20% improvement in vessel utilization rates
- **Process Compliance**: Zero regulatory findings related to record keeping

### Key Performance Indicators
- Average time to locate available vessel: < 30 seconds
- Measurement entry completion rate: > 95%
- Transfer documentation accuracy: 100%
- Quality alert response time: < 2 hours

## Constraints & Assumptions

### Technical Constraints
- Must integrate with existing vessel database schema
- Limited to PostgreSQL database platform
- Mobile interface must work on iOS and Android tablets
- Integration required with apple press scheduling system

### Business Constraints
- Implementation timeline: 3 months for MVP
- Budget for external integrations: Limited
- Training time: Maximum 4 hours per user
- No dedicated QA resources for testing

### Regulatory Constraints
- FDA compliance for measurement documentation
- State-level cidery licensing requirements
- Organic certification tracking if applicable
- HACCP plan integration for quality control

### Assumptions
- Production staff comfortable with tablet interfaces
- WiFi coverage adequate throughout production facility
- Barcode printers available for vessel labeling
- Current vessel data can be migrated from Excel

## Out of Scope

### Explicitly Excluded Features
- Automated fermentation monitoring sensors
- Integration with laboratory management systems
- Advanced statistical process control
- Predictive maintenance algorithms
- Multi-language interface support
- Automated transfer equipment control

### Future Considerations
- IoT sensor integration for automated measurements
- Machine learning for fermentation optimization
- Advanced analytics and business intelligence
- Integration with packaging line scheduling
- Customer portal for batch transparency

## Dependencies

### Internal Dependencies
- Apple press system completion and stabilization
- User authentication and RBAC system
- Mobile application infrastructure
- Database migration and optimization

### External Dependencies
- Barcode scanner hardware procurement
- Mobile device standardization
- Network infrastructure upgrades
- Staff training program development

### Technical Dependencies
- tRPC API extension for vessel operations
- React Native or Progressive Web App framework
- Drizzle ORM schema updates
- Real-time notification system implementation

## Technical Considerations

### Database Schema Updates
- Update existing vessels table status enum: add "empty", "fermenting", "storing", "aging" to existing values
- Create tank_measurements table: tank_id, temp_c, sh, ph, abv, notes, created_at, user_id
- Create tank_additives table: tank_id, additive_type, amount, unit, notes, created_at, user_id
- Extend existing transfer tracking for automatic status updates
- Add volume tracking fields for real-time capacity management

### API Design
- RESTful endpoints for vessel CRUD operations
- Real-time WebSocket connections for status updates
- Batch operation endpoints for bulk updates
- Mobile-optimized payload sizes

### Frontend Architecture
- Responsive design for desktop and mobile
- Progressive Web App capabilities
- Offline-first data synchronization
- Component library consistency with existing UI

### Integration Points
- Apple press scheduling system
- User management and authentication
- Notification and alert systems
- Reporting and analytics platform

## Implementation Phases

### Phase 1: Core Vessel Management (Month 1)
- Basic vessel CRUD operations
- Status tracking and availability
- Simple dashboard interface
- Database schema implementation

### Phase 2: Measurement and Quality (Month 2)
- Mobile measurement entry interface
- Quality trend analysis
- Alert and notification system
- Batch tracking integration

### Phase 3: Transfers and Scheduling (Month 3)
- Transfer workflow implementation
- Vessel scheduling calendar
- Advanced reporting capabilities
- User training and rollout

## Risk Mitigation

### Technical Risks
- **Data Migration Complexity**: Phased migration with validation checkpoints
- **Mobile Performance**: Progressive enhancement and offline capabilities
- **Integration Challenges**: API-first design with clear contracts

### Business Risks
- **User Adoption**: Comprehensive training program and change management
- **Data Quality**: Validation rules and automated error checking
- **Regulatory Compliance**: Legal review of documentation requirements

### Operational Risks
- **Production Disruption**: Parallel running during transition period
- **Training Overhead**: Just-in-time training with video tutorials
- **Support Requirements**: Documentation and FAQ development