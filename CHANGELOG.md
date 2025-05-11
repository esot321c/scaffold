# Changelog

All notable changes to the Scaffold project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [0.10.0] - 2025-05-11

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
