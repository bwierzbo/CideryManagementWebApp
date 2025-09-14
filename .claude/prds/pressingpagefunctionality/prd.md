# PRD: Pressing Page Functionality Enhancements

## 1. Executive Summary

**Feature Name:** Enhanced Pressing Page Functionality
**PRD Date:** September 13, 2025
**Owner:** Development Team
**Status:** Draft

### Problem Statement
The current pressing page provides basic functionality for managing press runs and juice lot assignments, but lacks advanced features needed for optimal cidery operations. Operators need real-time monitoring, quality control integration, predictive analytics, and workflow automation to maximize yield, ensure quality, and minimize operational overhead.

### Solution Overview
Enhance the pressing page with six core capability areas: real-time monitoring with alerts, advanced scheduling and planning, integrated quality control, comprehensive equipment management, enhanced data analytics, and intelligent workflow automation.

### Success Metrics
- 25% improvement in average press yield efficiency
- 40% reduction in manual data entry time
- 90% reduction in quality control incidents
- 50% improvement in equipment utilization rates
- 30% reduction in press run setup time

## 2. Background & Context

### Current State Analysis
The existing pressing page (`apps/web/src/app/pressing/page.tsx`) provides:
- Active press run management with vessel assignments
- Press run completion forms with yield calculations
- Historical tracking and basic reporting
- Mobile-responsive interface with role-based access

### Market Research & User Feedback
- Cidery operators spend 60% of pressing time on manual data entry
- Quality issues often go undetected until post-pressing analysis
- Equipment downtime averages 15% due to reactive maintenance
- Yield optimization potential of 20-30% exists with better data insights

### Business Impact
- **Revenue Impact:** $50K+ annually from improved yields and quality
- **Cost Savings:** $25K+ annually from reduced labor and waste
- **Risk Mitigation:** Significantly reduced quality control incidents

## 3. Objectives & Success Criteria

### Primary Objectives
1. **Operational Efficiency:** Streamline pressing workflow with automation
2. **Quality Assurance:** Integrate real-time quality monitoring and controls
3. **Data-Driven Decisions:** Provide actionable analytics and recommendations
4. **Equipment Optimization:** Maximize press utilization and minimize downtime

### Success Criteria
- Press operators complete runs 30% faster with new workflow automation
- Quality incidents reduced by 90% through real-time monitoring
- Equipment utilization improved by 50% with predictive maintenance
- User satisfaction scores above 4.5/5.0 for new functionality

## 4. Functional Requirements

### 4.1 Real-time Monitoring & Alerts

#### FR-1.1 Live Parameter Monitoring
**Description:** Display real-time temperature, pressure, and flow rate data during pressing operations.

**Requirements:**
- Integration with IoT sensors on pressing equipment
- Live dashboard with color-coded status indicators
- Historical parameter tracking with 1-minute resolution
- Configurable parameter thresholds and ranges

#### FR-1.2 Automated Alert System
**Description:** Generate alerts when critical parameters exceed safe operating ranges.

**Requirements:**
- Email/SMS notifications for critical alerts
- In-app notification system with severity levels
- Escalation procedures for unacknowledged alerts
- Alert history and resolution tracking

#### FR-1.3 Predictive Yield Tracking
**Description:** Real-time yield prediction based on current pressing parameters and historical data.

**Requirements:**
- Machine learning model for yield prediction
- Live yield efficiency indicators
- Comparison with historical averages
- Optimization recommendations during pressing

### 4.2 Advanced Scheduling & Planning

#### FR-2.1 Intelligent Press Scheduling
**Description:** Optimize press schedule based on apple maturity, equipment availability, and production targets.

**Requirements:**
- Apple maturity tracking and optimal pressing windows
- Equipment capacity planning and availability management
- Production target integration and deadline tracking
- Automated schedule generation with manual override

#### FR-2.2 Resource Allocation Optimization
**Description:** Automatically assign vessels, equipment, and personnel based on press run requirements.

**Requirements:**
- Vessel capacity matching with expected yields
- Equipment availability validation
- Personnel shift scheduling integration
- Resource conflict detection and resolution

#### FR-2.3 Batch Sequencing Automation
**Description:** Automatically sequence press runs to minimize equipment changeover time and maximize efficiency.

**Requirements:**
- Similar variety grouping for minimal cleaning
- Equipment-specific sequencing optimization
- Changeover time estimation and scheduling
- Priority-based run ordering system

### 4.3 Quality Control Integration

#### FR-3.1 In-line Quality Testing
**Description:** Integrate real-time quality measurements during pressing operations.

**Requirements:**
- Brix measurement integration with automatic recording
- pH monitoring with trend analysis
- Color and clarity assessment tools
- Microbiological testing result integration

#### FR-3.2 Quality Gate Validation
**Description:** Automated quality checkpoints that prevent substandard juice from proceeding to fermentation.

**Requirements:**
- Configurable quality thresholds by variety
- Automatic hold/release decisions based on test results
- Quality deviation alerts and corrective action workflows
- Quality certificate generation for approved lots

#### FR-3.3 Compliance Documentation
**Description:** Automatic generation of quality control documentation for regulatory compliance.

**Requirements:**
- FDA/HACCP compliance report generation
- Batch quality summary documentation
- Quality trend analysis and reporting
- Audit trail for all quality decisions

### 4.4 Equipment Management

#### FR-4.1 Equipment Status Monitoring
**Description:** Real-time monitoring of press equipment health, performance, and maintenance needs.

**Requirements:**
- Equipment status dashboard with health indicators
- Performance metrics tracking (efficiency, throughput, downtime)
- Maintenance schedule integration and reminders
- Equipment lifecycle management

#### FR-4.2 Predictive Maintenance
**Description:** Predict equipment maintenance needs based on usage patterns and performance data.

**Requirements:**
- Machine learning models for failure prediction
- Maintenance recommendation engine
- Parts inventory integration for proactive ordering
- Maintenance cost analysis and ROI tracking

#### FR-4.3 Performance Analytics
**Description:** Comprehensive analytics on equipment performance and utilization.

**Requirements:**
- Equipment efficiency trending and benchmarking
- Utilization rate analysis and optimization recommendations
- Cost per unit analysis by equipment
- Performance comparison across similar equipment

### 4.5 Enhanced Data Analytics

#### FR-5.1 Yield Optimization Engine
**Description:** Advanced analytics to identify yield optimization opportunities.

**Requirements:**
- Multi-variable analysis of yield factors
- Optimization recommendations with expected impact
- A/B testing framework for process improvements
- ROI calculation for optimization initiatives

#### FR-5.2 Historical Performance Analysis
**Description:** Comprehensive historical analysis of pressing operations.

**Requirements:**
- Multi-year trend analysis with seasonal adjustments
- Variety-specific performance comparisons
- Equipment performance history and degradation tracking
- Cost analysis trends and benchmarking

#### FR-5.3 Predictive Analytics Dashboard
**Description:** Forward-looking analytics to predict future pressing performance and needs.

**Requirements:**
- Seasonal demand forecasting and capacity planning
- Quality prediction models based on apple characteristics
- Equipment maintenance scheduling optimization
- Resource requirement forecasting

### 4.6 Workflow Automation

#### FR-6.1 Intelligent Vessel Assignment
**Description:** Automatically assign optimal vessels based on expected yield, juice characteristics, and vessel availability.

**Requirements:**
- Vessel capacity optimization algorithms
- Juice compatibility matching (variety, quality grade)
- Cleaning schedule integration
- Override capability for manual assignments

#### FR-6.2 Automated Documentation
**Description:** Automatically generate all required documentation for press runs.

**Requirements:**
- Press run reports with all parameters and results
- Juice lot certificates with quality data
- Batch cards for fermentation handoff
- Regulatory compliance documentation

#### FR-6.3 Inventory Integration
**Description:** Seamless integration with inventory management for real-time stock updates.

**Requirements:**
- Automatic juice lot creation in inventory system
- Real-time juice volume tracking and allocation
- Vessel occupancy updates and availability management
- Raw material consumption tracking and reordering

## 5. Non-Functional Requirements

### 5.1 Performance Requirements
- Page load time under 2 seconds for standard views
- Real-time data refresh rate of 1 second for critical parameters
- Support for 50+ concurrent users during pressing operations
- 99.5% system uptime during production hours

### 5.2 Security Requirements
- Role-based access control for all functionality
- Audit logging for all critical operations and changes
- Data encryption in transit and at rest
- Secure API authentication for IoT device integration

### 5.3 Usability Requirements
- Mobile-responsive design for tablet and smartphone use
- Intuitive interface requiring minimal training
- Accessibility compliance (WCAG 2.1 AA)
- Multi-language support (English, Spanish initially)

### 5.4 Integration Requirements
- RESTful APIs for IoT sensor integration
- Compatible with existing tRPC architecture
- PostgreSQL database with Drizzle ORM
- Integration with external quality testing equipment

### 5.5 Scalability Requirements
- Horizontal scaling capability for increased pressing capacity
- Data archival strategy for long-term historical data
- Cloud deployment compatibility (Vercel, AWS, GCP)
- Microservices architecture for component independence

## 6. User Stories & Acceptance Criteria

### Epic 1: Real-time Monitoring & Alerts

#### User Story 1.1
**As a** press operator
**I want** to see real-time temperature and pressure readings during pressing
**So that** I can ensure optimal pressing conditions and prevent equipment damage

**Acceptance Criteria:**
- [ ] Dashboard displays live temperature, pressure, and flow rate
- [ ] Data updates every second during active pressing
- [ ] Color-coded indicators show normal/warning/critical status
- [ ] Historical parameter charts available for trend analysis
- [ ] Mobile-responsive display for tablet use

#### User Story 1.2
**As a** production manager
**I want** to receive immediate alerts when pressing parameters go out of range
**So that** I can take corrective action before quality issues occur

**Acceptance Criteria:**
- [ ] Email and SMS alerts sent for critical parameter violations
- [ ] In-app notifications with severity levels (info, warning, critical)
- [ ] Alert acknowledgment system with timestamp logging
- [ ] Escalation to supervisor if alerts not acknowledged within 15 minutes
- [ ] Alert history dashboard for pattern analysis

### Epic 2: Advanced Scheduling & Planning

#### User Story 2.1
**As a** production planner
**I want** the system to automatically suggest optimal press schedules
**So that** I can maximize equipment utilization and meet production targets

**Acceptance Criteria:**
- [ ] Algorithm considers apple maturity, equipment availability, and targets
- [ ] Schedule suggestions include resource assignments and timing
- [ ] Manual override capability for schedule adjustments
- [ ] Conflict detection and alternative suggestions
- [ ] Integration with harvest schedule and fermentation capacity

#### User Story 2.2
**As a** press operator
**I want** vessels to be automatically assigned based on expected yield
**So that** I don't need to manually calculate capacity requirements

**Acceptance Criteria:**
- [ ] System calculates expected yield from historical data
- [ ] Vessel assignments consider capacity, availability, and compatibility
- [ ] Override capability for manual vessel selection
- [ ] Cleaning schedule integration prevents contamination
- [ ] Visual confirmation of assignments before press run start

### Epic 3: Quality Control Integration

#### User Story 3.1
**As a** quality manager
**I want** real-time Brix and pH measurements automatically recorded
**So that** I have complete quality documentation without manual data entry

**Acceptance Criteria:**
- [ ] Integration with inline Brix and pH meters
- [ ] Automatic data recording every 5 minutes during pressing
- [ ] Quality trend charts with acceptable range indicators
- [ ] Alert system for out-of-specification measurements
- [ ] Quality certificate generation with all recorded data

#### User Story 3.2
**As a** production supervisor
**I want** the system to automatically hold juice lots that fail quality gates
**So that** substandard product doesn't accidentally proceed to fermentation

**Acceptance Criteria:**
- [ ] Configurable quality thresholds by apple variety
- [ ] Automatic hold status applied to failing lots
- [ ] Quality manager notification for held lots
- [ ] Hold release approval workflow
- [ ] Quality deviation investigation form

### Epic 4: Equipment Management

#### User Story 4.1
**As a** maintenance manager
**I want** predictive maintenance recommendations based on equipment usage
**So that** I can prevent unexpected downtime and optimize maintenance costs

**Acceptance Criteria:**
- [ ] Machine learning model analyzes equipment performance data
- [ ] Maintenance recommendations with priority levels
- [ ] Integration with parts inventory for availability checking
- [ ] Maintenance cost-benefit analysis
- [ ] Maintenance history tracking and effectiveness metrics

### Epic 5: Enhanced Data Analytics

#### User Story 5.1
**As a** production manager
**I want** yield optimization recommendations based on historical analysis
**So that** I can improve pressing efficiency and reduce waste

**Acceptance Criteria:**
- [ ] Multi-variable analysis identifies yield improvement opportunities
- [ ] Recommendations include expected impact and implementation steps
- [ ] A/B testing framework for validating improvements
- [ ] ROI calculation for optimization initiatives
- [ ] Comparison with industry benchmarks

### Epic 6: Workflow Automation

#### User Story 6.1
**As a** press operator
**I want** all required documentation automatically generated after pressing
**So that** I can focus on operations instead of paperwork

**Acceptance Criteria:**
- [ ] Press run report generation with all parameters and results
- [ ] Juice lot certificates with quality data
- [ ] Batch cards for fermentation team handoff
- [ ] Regulatory compliance documentation
- [ ] PDF export and email distribution capability

## 7. Technical Architecture

### 7.1 System Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IoT Sensors   │    │   Quality Lab   │    │  ERP Systems    │
│  (Temperature,  │    │   Equipment     │    │  (Inventory,    │
│   Pressure,     │────┤                 │────┤   Finance)      │
│   Flow Rate)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (tRPC v11)    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Business Logic │
                    │    Services     │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Next.js 15    │
                    │   Frontend      │
                    └─────────────────┘
```

### 7.2 Database Schema Extensions
```sql
-- Real-time monitoring data
CREATE TABLE pressing_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    press_run_id UUID NOT NULL REFERENCES press_runs(id),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    temperature DECIMAL(5,2),
    pressure DECIMAL(8,2),
    flow_rate DECIMAL(8,2),
    brix DECIMAL(4,1),
    ph DECIMAL(3,1),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Equipment monitoring
CREATE TABLE equipment_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    performance_metrics JSONB,
    last_maintenance TIMESTAMP,
    next_maintenance TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Quality control records
CREATE TABLE quality_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    juice_lot_id UUID NOT NULL REFERENCES juice_lots(id),
    test_type VARCHAR(100) NOT NULL,
    test_result DECIMAL(10,4),
    test_unit VARCHAR(20),
    acceptable_range JSONB,
    passed BOOLEAN NOT NULL,
    tested_by UUID REFERENCES users(id),
    tested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Predictive analytics
CREATE TABLE yield_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    press_run_id UUID NOT NULL REFERENCES press_runs(id),
    predicted_yield DECIMAL(10,2),
    confidence_score DECIMAL(3,2),
    model_version VARCHAR(50),
    prediction_factors JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 7.3 API Endpoints
```typescript
// Real-time monitoring
router.pressing.parameters.list
router.pressing.parameters.stream  // WebSocket for live updates
router.pressing.alerts.list
router.pressing.alerts.acknowledge

// Equipment management
router.equipment.status.list
router.equipment.maintenance.predict
router.equipment.performance.analyze

// Quality control
router.quality.tests.record
router.quality.gates.evaluate
router.quality.compliance.generate

// Analytics
router.analytics.yield.optimize
router.analytics.performance.analyze
router.analytics.predictions.generate

// Automation
router.automation.schedule.generate
router.automation.vessels.assign
router.automation.documentation.generate
```

### 7.4 Integration Points
- **IoT Sensor Integration:** MQTT protocol for real-time data ingestion
- **Quality Lab Equipment:** REST APIs for automated test result import
- **ERP System Integration:** GraphQL federation for inventory/finance data
- **Mobile App:** Progressive Web App with offline capability
- **Third-party Analytics:** Export APIs for business intelligence tools

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- Database schema extensions
- Basic IoT sensor integration
- Real-time parameter monitoring dashboard
- Alert system implementation

### Phase 2: Quality & Analytics (Weeks 5-8)
- Quality control integration
- Historical data analysis
- Predictive yield modeling
- Performance analytics dashboard

### Phase 3: Automation (Weeks 9-12)
- Automated scheduling engine
- Vessel assignment automation
- Documentation generation
- Equipment maintenance predictions

### Phase 4: Optimization (Weeks 13-16)
- Advanced analytics and ML models
- Process optimization recommendations
- Mobile app enhancements
- Third-party integrations

## 9. Risk Assessment

### High Risk Items
- **IoT Integration Complexity:** Multiple sensor types and protocols
  - *Mitigation:* Phased rollout starting with temperature sensors
- **Real-time Performance:** High-frequency data updates may impact system performance
  - *Mitigation:* Dedicated WebSocket infrastructure and data aggregation

### Medium Risk Items
- **User Adoption:** Complex new features may overwhelm operators
  - *Mitigation:* Extensive training program and gradual feature rollout
- **Data Quality:** Sensor data quality may affect analytics accuracy
  - *Mitigation:* Data validation rules and sensor calibration procedures

### Low Risk Items
- **Technical Debt:** Additional complexity may impact maintainability
  - *Mitigation:* Comprehensive documentation and code review processes

## 10. Success Metrics & KPIs

### Primary Metrics
- **Yield Efficiency:** Target 25% improvement in average press yield
- **Quality Incidents:** Target 90% reduction in quality control issues
- **Equipment Utilization:** Target 50% improvement in equipment efficiency
- **Operational Speed:** Target 30% reduction in press run cycle time

### Secondary Metrics
- **User Satisfaction:** Target 4.5/5.0 rating for new functionality
- **System Performance:** Maintain <2 second page load times
- **Data Accuracy:** >99% accuracy for automated measurements
- **Cost Savings:** Target $75K+ annual savings from efficiency gains

### Measurement Framework
- Weekly operational reports with key metrics
- Monthly user satisfaction surveys
- Quarterly ROI analysis and business impact assessment
- Annual comprehensive performance review

## 11. Appendices

### Appendix A: Current System Limitations
- Manual data entry for all pressing parameters
- No real-time monitoring or alerting
- Limited historical analysis capabilities
- Reactive maintenance approach
- Basic yield calculations without optimization

### Appendix B: Competitive Analysis
- **CiderTech Pro:** Strong equipment integration but limited analytics
- **FruitFlow:** Excellent scheduling but poor mobile experience
- **PressMaster:** Advanced quality control but high complexity
- **Our Advantage:** Integrated approach with modern tech stack

### Appendix C: User Research Summary
- 15 operator interviews conducted across 5 cideries
- Common pain points: manual data entry (87%), quality incidents (73%), equipment downtime (60%)
- Most requested features: real-time monitoring (93%), automated documentation (80%), yield optimization (67%)

### Appendix D: Technical Dependencies
- IoT sensor hardware procurement and installation
- Network infrastructure upgrades for real-time data
- Third-party API integrations for quality equipment
- Machine learning model development and training
- Mobile device standardization for field use