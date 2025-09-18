# Purchase Order PDF Reports - User Guide

## Overview

The Purchase Order PDF Reports system allows you to generate professional PDF documents for vendor communications and create comprehensive date-range reports for internal analysis. This guide covers all user-facing functionality.

## Quick Start

### Generating a Single Purchase Order PDF

1. **Navigate to Purchasing**: Go to the Purchasing page from the main navigation
2. **Find Your Purchase**: Locate the purchase order in the Recent Purchases table
3. **Generate PDF**: Click the "Generate PDF" button next to the purchase
4. **Download**: The PDF will be generated and downloaded automatically

### Emailing Purchase Orders to Vendors

1. **Generate PDF**: Follow the steps above to generate a PDF
2. **Email to Vendor**: Click the "Email to Vendor" button
3. **Review Email**: A modal will open showing:
   - Vendor email address (auto-populated)
   - Email subject (editable)
   - Email body (template with your message)
   - PDF attachment preview
4. **Send**: Click "Send Email" to deliver the purchase order

### Creating Date Range Reports

1. **Navigate to Reports**: Go to the Reports & Analytics page
2. **Select Date Range**: Choose from predefined ranges or select custom dates:
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - Last year
   - Custom date range
3. **Apply Filters** (optional):
   - Filter by specific vendors
   - Filter by purchase categories
   - Filter by amount ranges
4. **Generate Report**: Click "Generate Report"
5. **Download**: The comprehensive PDF report will be generated and downloaded

## PDF Report Types

### Purchase Order PDFs

**Purpose**: Professional documents for vendor communication
**Format**: Invoice-style layout with:
- Cidery letterhead and branding
- Purchase order number and date
- Vendor contact information
- Itemized line items with quantities and prices
- Subtotal, tax, and total amounts
- Payment terms and delivery instructions

**Use Cases**:
- Sending purchase orders to vendors
- Record keeping and compliance
- Vendor relationship management
- Financial documentation

### Date Range Reports

**Purpose**: Internal analysis and reporting
**Format**: Comprehensive multi-page reports with:
- Executive summary with key metrics
- Purchase activity timeline
- Vendor performance analysis
- Cost breakdown by category
- Volume and trend analysis
- Financial summaries and totals

**Use Cases**:
- Monthly/quarterly business reviews
- Cost analysis and budgeting
- Vendor performance evaluation
- Inventory planning
- Financial reporting

## Email Templates

### Purchase Order Email

**Template Features**:
- Professional business formatting
- Personalized vendor greeting
- Purchase order details summary
- PDF attachment notification
- Contact information for questions
- Professional email signature

**Customization Options**:
- Subject line editing
- Message body customization
- CC/BCC recipients
- Delivery priority settings

### Report Delivery Email

**Template Features**:
- Internal distribution formatting
- Report period and scope summary
- Key metrics highlights
- PDF attachment details
- Distribution list management

## User Interface Features

### Reports Dashboard

**Overview Section**:
- Quick metrics and KPIs
- Recent report history
- Favorite report configurations
- System status indicators

**Filter Controls**:
- Date range picker with calendar
- Vendor multi-select dropdown
- Category filter checkboxes
- Amount range sliders
- Advanced filter options

**Report Queue**:
- Active report generation status
- Progress indicators with time estimates
- Download links for completed reports
- Error status and retry options

### Purchase Integration

**Purchase History Table**:
- PDF generation buttons for each purchase
- Email status indicators
- Last emailed timestamp
- Vendor contact status

**Quick Actions**:
- One-click PDF generation
- Bulk email operations
- Batch report generation
- Export to various formats

## Performance and Limitations

### Generation Times

**Single Purchase Order PDFs**:
- Simple orders (1-10 items): &lt; 5 seconds
- Complex orders (10-50 items): &lt; 10 seconds
- Large orders (50+ items): &lt; 15 seconds

**Date Range Reports**:
- 7-day reports: &lt; 30 seconds
- 30-day reports: &lt; 60 seconds
- 90-day reports: &lt; 2 minutes
- Year-end reports: &lt; 5 minutes

### Concurrent Usage

The system supports up to 5 simultaneous report generations. If the limit is reached:
- Reports queue automatically
- Progress indicators show wait time
- Email notifications sent when complete
- Priority queuing for urgent reports

### File Size Limits

**PDF Generation**:
- Maximum 50 MB per PDF file
- Automatic compression for large reports
- Image optimization for faster loading
- Font subsetting for smaller files

**Email Attachments**:
- Maximum 25 MB per email attachment
- Large reports split into multiple emails
- Cloud storage links for very large files
- Alternative delivery methods available

## Best Practices

### For Purchase Orders

1. **Review Before Sending**: Always preview PDFs before emailing to vendors
2. **Verify Vendor Information**: Ensure vendor email addresses are current
3. **Use Professional Templates**: Stick to standard templates for consistency
4. **Track Delivery**: Monitor email delivery status and follow up if needed
5. **Archive Communications**: Keep copies of all vendor communications

### For Date Range Reports

1. **Regular Scheduling**: Generate reports on consistent schedules
2. **Filter Appropriately**: Use relevant filters to focus on specific areas
3. **Compare Periods**: Use consistent date ranges for trend analysis
4. **Share Insights**: Distribute reports to relevant stakeholders
5. **Archive Historical Data**: Maintain report history for trend analysis

### For Performance

1. **Off-Peak Generation**: Generate large reports during low-usage periods
2. **Batch Operations**: Group similar report requests together
3. **Cache Results**: Reuse recent reports when possible
4. **Monitor Queues**: Check system status before starting large operations
5. **Optimize Filters**: Use specific filters to reduce processing time

## Troubleshooting

### Common Issues

**PDF Generation Fails**:
- Check internet connection
- Verify purchase data completeness
- Try refreshing the page
- Contact support if errors persist

**Email Delivery Problems**:
- Verify vendor email addresses
- Check spam/junk folders
- Confirm email service status
- Review delivery tracking logs

**Slow Report Generation**:
- Reduce date range scope
- Apply more specific filters
- Check system load indicators
- Try during off-peak hours

**File Download Issues**:
- Enable pop-ups for the site
- Check browser download settings
- Clear browser cache
- Try a different browser

### Getting Help

**Self-Service Resources**:
- Check troubleshooting guide
- Review FAQ section
- Watch tutorial videos
- Access online help system

**Support Channels**:
- Email: support@ciderymanagement.com
- Phone: 1-800-CIDERY-1
- Chat: Available during business hours
- Documentation: docs.ciderymanagement.com

**Reporting Issues**:
- Include error messages
- Describe steps to reproduce
- Provide screenshot if helpful
- Note browser and device information

## Security and Compliance

### Data Protection

- All PDFs generated with encryption
- Email transmissions use TLS encryption
- Vendor data protected according to privacy policies
- Access controls based on user roles

### Audit Trail

- All PDF generations logged
- Email delivery tracking maintained
- User actions recorded with timestamps
- Comprehensive audit reports available

### Compliance

- SOX compliance for financial reporting
- GDPR compliance for vendor data
- Industry-standard security practices
- Regular security audits and updates

## Next Steps

After mastering basic PDF generation:

1. **Explore Advanced Filtering**: Learn complex filter combinations
2. **Set Up Automated Reports**: Schedule regular report delivery
3. **Customize Templates**: Work with admin to modify templates
4. **Integrate with Workflows**: Incorporate into existing business processes
5. **Analyze Trends**: Use historical data for business insights

For advanced features and administrative functions, see the [Administrator Guide](../admin/reports/admin-guide.md).