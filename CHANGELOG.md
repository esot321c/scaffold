# Changelog

All notable changes to the Scaffold project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
