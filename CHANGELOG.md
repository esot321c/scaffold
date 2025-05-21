# Changelog

All notable changes to the Scaffold project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.14.0] - 2025-05-21

### Added

- Real-time System Health Dashboard:
  - Live health monitoring dashboard in admin interface showing database, Redis, and MongoDB connection status
  - System resource monitoring with visual indicators for CPU, memory, and disk usage
  - Service response time tracking and last-checked timestamps
  - Color-coded health status indicators (healthy, degraded, down)
- Health API Endpoint:
  - New `/admin/health` endpoint providing real-time system metrics
  - Integration with existing health monitoring infrastructure
  - Automatic health checks with configurable thresholds
- Enhanced Admin Interface:
  - Updated admin dashboard with comprehensive system overview
  - Visual progress bars for resource usage metrics
  - Auto-refreshing health data every minute

### Changed

- Enhanced admin dashboard layout with health monitoring as primary section
- Improved visual hierarchy in admin interface
- Extended monitoring module to expose health metrics via REST API

### Fixed

- Added missing Tailwind color definitions for success, warning, and info states
- Improved error handling in health check endpoints

## [0.13.0] - 2025-05-21

### Added

- Comprehensive Redis-backed rate limiting system
  - Path-based rate limiting with different rules for auth, admin, and API endpoints
  - User ID and IP address tracking for more accurate rate limit enforcement
  - Admin interface for viewing and adjusting rate limits
  - Configurable through database with graceful fallbacks
- Extensive E2E Testing Suite:
  - End-to-end tests for authentication flows and security features
  - Tests for authentication context switching prevention
  - Rate limiting effectiveness verification
  - Integration with security logging system

### Security Improvements

- Fixed critical authentication vulnerabilities
  - Addressed vulnerability allowing CSRF protection bypass through authentication context switching
  - Implemented stricter validation of authentication methods (cookie vs. Bearer)
  - Added comprehensive logging of authentication context violations

### Changed

- Enhanced test coverage for critical security components
- Improved authentication testing methodology
- Added verification of security logs as part of test suite
- Strengthened token validation in JWT strategy

### Fixed

- **Critical**: Fixed vulnerability allowing users to bypass CSRF protection by using refresh tokens as Bearer tokens
- Improved token type validation with proper authentication context enforcement
- Enhanced handling of conflicting authentication methods

## [0.12.0] - 2025-05-16

### Added

- Comprehensive health monitoring system

  - CPU, memory, and disk usage monitoring with configurable thresholds
  - Service availability tracking for database, Redis, and MongoDB
  - Error rate monitoring with threshold-based alerting
  - Automatic detection and notification of system recovery events

- Event-driven system health architecture

  - Central event bus for system health notifications
  - Decoupled monitoring and notification components
  - Standardized event format for consistent handling

- Advanced admin notification system

  - Real-time alerts for critical system events
  - Email notifications with severity-based formatting
  - Intelligent throttling to prevent notification storms
  - Fallback delivery paths for notifications during service outages
  - Handlebars-based email templates for consistent formatting

- Notification customization

  - Per-admin configurable preferences
  - Event type filtering and severity thresholds
  - Hourly and daily digest options for non-critical notifications
  - Customizable quiet hours with timezone support

- Admin notification UI

  - Preference management in admin dashboard
  - Test notification functionality
  - Expanded admin sidebar with notifications section

- Custom timezone utilities package

  - IANA timezone support with consistent formatting
  - Time offset calculation and display
  - Timezone-aware date formatting helpers
  - Used throughout the application for consistent time display

- Enhanced Redis integration
  - Improved connection handling and monitoring
  - Automatic reconnection with event emission
  - Better error handling for queue operations

### Changed

- Enhanced error handling throughout the application
- Improved system resilience with multiple fallback mechanisms
- Extended admin interface with system health monitoring capabilities

### Fixed

- Added proper JWT authentication to CSRF token refreshing endpoint
- Verified correct HTTP status codes (401/403) for all auth endpoints
- Fixed inconsistent error handling in sensitive API operations

## [0.11.0] - 2025-05-11

### Added

- Complete device management UI for user profiles
- Device visualization with platform detection
- Device trust status management
- Current device identification and highlighting
- Device removal functionality
- Privacy Policy template with standard legal sections
- Terms of Service template with common legal clauses
- Legal pages UI with tab-based navigation
- Footer links to legal documents

### Changed

- Enhanced security section in user profile with device management
- Improved device recognition logic in backend
- Updated security logging for device-related actions

## [0.10.0] - 2025-05-10

### Added

- Advanced logging system with MongoDB integration
- Configurable log retention policies through Admin UI
- Security event monitoring dashboard with filtering capabilities
- Log export functionality for compliance and auditing
- User activity timeline for enhanced security visibility
- Admin interface for log management and configuration
- TTL indexes for automatic log rotation based on retention policies
- Optimized MongoDB queries for log retrieval and analysis
- Fallback to file-based logging when MongoDB is unavailable
- Real-time security event tracking and visualization

### Changed

- Restructured logging architecture for better performance
- Enhanced admin dashboard with security-focused views
- Improved session management UI with clearer device information
- Updated environment configuration to support optional MongoDB
- Enhanced Docker Compose setup with MongoDB container

### Fixed

- Session tracking inconsistencies in security logs
- Missing context in API request logs
- Inefficient log storage and retrieval mechanisms
- Lack of configurable retention policies for compliance needs

## [0.9.0] - 2025-05-03

### Added

- Comprehensive API error standardization system
- Standardized error types (Authentication, Authorization, Validation, Server, Network, Unknown)
- Request ID tracking across frontend and backend for error correlation
- Global exception filter for consistent API error responses
- Field-specific validation error formatting and display
- Smart retry policies based on error types in the query client
- FormError component for displaying validation errors in forms
- ApiError interface for type-safe error handling

### Changed

- Replaced direct fetch calls with standardized apiClient utility
- Improved error handling in authentication flows
- Enhanced validation error display in profile forms
- Updated API client to properly handle and transform error responses

### Fixed

- Inconsistent error handling across different components
- Missing error messages in form validation
- Lack of error traceability between frontend and backend

## [0.8.0] - 2025-04-15

### Added

- Initial release of Scaffold
- Authentication system with Google OAuth
- Session management with JWT and refresh tokens
- CSRF protection for all endpoints
- Comprehensive activity and security logging
- Admin portal with user management
- Device tracking and management
- Type-safe communication between frontend and backend
