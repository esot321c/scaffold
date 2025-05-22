# Scaffold

![Version](https://img.shields.io/badge/version-0.14.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build Status](https://img.shields.io/badge/build-passing-success.svg)

> An enterprise-grade TypeScript foundation for building secure, monitored, and scalable modern web applications.

Scaffold is a production-ready, authentication-first foundation for building modern web applications. It combines the power of NestJS on the backend with Tanstack Router and shadcn/ui on the frontend to provide a complete, type-safe development experience with built-in security, monitoring, and notification systems.

## System Architecture

Scaffold uses an event-driven architecture for health monitoring and notifications:

```
┌───────────────┐    ┌──────────────┐    ┌───────────────┐
│ Health Monitors│───>│  Event Bus   │───>│ Notification  │
└───────────────┘    └──────────────┘    │   Service     │
      │                                  └───────┬───────┘
      │                                          │
┌─────▼───────┐                         ┌────────▼───────┐
│ System      │                         │ Email / Queue  │
│ Metrics     │                         │ Processors     │
└─────────────┘                         └────────────────┘
```

## Features

### Authentication & Security

- Authentication system with Google OAuth integration
- Session management with JWT and refresh tokens
- CSRF protection for all endpoints
- Device management with trust status and removal capabilities
- Path-based rate limiting for all endpoints with different rules for auth, admin, and API routes
- Protection against authentication context switching attacks
- Strict validation of authentication methods with security event logging
- Privacy Policy and Terms of Service templates

### Administration & Monitoring

- Admin portal with user management
- Advanced logging system with MongoDB integration
- Configurable log retention policies
- Security event monitoring dashboard with filtering and export
- User activity tracking and visualization
- Health monitoring with automated alerts for system metrics and service availability
- Intelligent notification system with email delivery, digests, and customizable preferences
- Real-time system health dashboard with service status monitoring
- Visual resource usage indicators for CPU, memory, and disk space
- Database, Redis, and MongoDB connection health tracking

### Developer Experience

- Type-safe communication between frontend and backend
- API standardization with consistent error handling
- Shared TypeScript types between packages
- Custom timezone utilities for consistent formatting across the application
- Responsive UI components with shadcn/ui and Tailwind

## Architecture Decisions

- **Monorepo Structure**: A monorepo approach was chosen to enable sharing TypeScript types between frontend and backend, ensuring complete type safety across the application boundary. This could be broken into separate repos, and the types package could be published as an npm package or hosted in a private package registry (like GitHub Packages, Azure Artifacts, or Nexus Repository) if needed. The monorepo approach simplifies development workflow and ensures types stay in sync during rapid development, while still allowing for future separation if organizational needs require it.
- **Separate Frontend/Backend**: Rather than using a serverless web app, this architecture provides the flexibility to run background jobs, notification systems, and cron tasks. It also supports multiple client applications (web, Android, iOS) sharing the same backend API.
- **NestJS for Backend**: Provides a structured, modular architecture with dependency injection, making the codebase maintainable and testable. The patterns established here could be implemented in other backend languages like C#/.NET, Rust, or Go if team expertise or performance requirements change in the future.
- **PostgreSQL with Prisma**: Offers type-safe database access with migrations, ensuring data integrity and developer productivity.
- **Redis for Caching**: The system includes Redis infrastructure for performance optimization, allowing efficient caching of external API responses, expensive database queries, or other frequently accessed data. This caching layer can significantly reduce latency and minimize costs when integrating with rate-limited or pay-per-call third-party services.
- **Advanced Logging System**: A flexible, configurable logging infrastructure with MongoDB support for structured logs, retention policies, and comprehensive security event tracking. This system provides visibility into user activity, security events, and API performance while maintaining appropriate data retention policies.
- **Session-Based Authentication**: We implemented a hybrid JWT+session approach for auth, providing the flexibility of JWTs while maintaining the security benefits of server-side sessions with explicit invalidation capability.
- **Comprehensive Security Logging**: Security events are systematically logged and available both to users (for their own activity) and administrators, improving transparency and aiding in security incident response.
- **CSRF Protection**: All non-GET endpoints are protected by CSRF tokens to prevent cross-site request forgery attacks, with a cookie-based implementation. This is enforced through a global middleware that protects all routes except those explicitly excluded (such as OAuth callbacks), ensuring consistent security across the application.
- **Automated Token Rotation**: The system implements a scheduled token rotation mechanism that automatically refreshes sessions nearing expiration, enhancing security without disrupting user experience. This helps prevent session hijacking while maintaining seamless authentication.
- **Configurable Security Log Retention**: The system includes an automated log cleanup service that prunes older security logs according to configurable retention periods. This helps maintain system performance while preserving important security audit trails for an appropriate duration based on organizational requirements.
- **Device Management**: The system tracks and allows management of authenticated devices, enhancing security by giving users visibility and control over their active sessions.
- **Admin Module Separation**: Admin functionality is isolated in its own module with separate guards, providing clear separation of concerns.
- **Event-Driven Monitoring**: The system uses an event-driven architecture for health monitoring and notifications, allowing for loose coupling between components and easier extension with new monitoring capabilities. Events flow through a central event bus, with standardized formats ensuring consistent processing regardless of the event source.
- **Tiered Notification Strategy**: Notifications are delivered through a tiered strategy: immediate critical alerts, hourly digests for important but non-urgent issues, and daily summaries for routine information. This ensures attention is appropriately directed based on severity.
- **Resilient Communication Paths**: The notification system is designed with multiple fallback paths to ensure critical alerts are delivered even during partial system outages. This includes cached admin contact information and dedicated emergency channels.
- **BullMQ for Job Processing**: The notification system leverages BullMQ (backed by Redis) for reliable background job processing. This provides guaranteed delivery of notifications, rate limiting, automatic retries, and concurrency control. Jobs are persisted in Redis, ensuring notification delivery even if the application restarts during processing.
- **Resend for Email Delivery**: For reliable email communication, Scaffold integrates Resend as the transactional email provider. This modern API-based platform offers high deliverability rates, detailed delivery tracking, and template management. Resend also provides easy integration with our notification templates and priority handling for critical alerts.
- **Comprehensive Rate Limiting**: The system implements a Redis-backed rate limiting solution with path-based rules for different endpoint types. This prevents abuse of API endpoints, protects against brute force attacks, and provides different rate limit thresholds based on endpoint sensitivity (authentication endpoints being most restrictive). Rate limits are configurable through database settings with graceful fallbacks to defaults when needed.
- **Health Monitoring Dashboard**: The admin interface includes a real-time health monitoring dashboard that provides immediate visibility into system status. This builds on the existing health monitoring infrastructure by exposing metrics through a REST API, allowing administrators to quickly assess system health without relying solely on notifications. The dashboard includes service connectivity status, resource usage metrics, and response time tracking.

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm
- Docker and Docker Compose (for local database)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/scaffold
cd scaffold

# Install dependencies
pnpm install

# Set up environment variables
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

### Environment Configuration

1. **Generate secure passwords for Redis, Postgres, and MongoDB**:

```bash
# Generate Redis password
openssl rand -hex 16

# Generate Postgres password
openssl rand -hex 16

# Generate MongoDB password (optional)
openssl rand -hex 16

# Generate JWT Secret
openssl rand -hex 32
```

2. **Update backend .env file** with your generated values and OAuth credentials

3. **Set up Google OAuth** (required):

   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Navigate to "APIs & Services" > "Credentials"
   - Create an OAuth 2.0 Client ID
   - Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
   - Copy Client ID and Secret to your backend .env file

4. **Configure Email for Notifications** (required for admin alerts):

   - Set up a [Resend](https://resend.com) account for email delivery
   - Add your API key to the `RESEND_API_KEY` environment variable
   - Configure sender email in `FROM_ADDRESS`
   - Set emergency contacts in `EMERGENCY_ADMIN_EMAILS` (comma-separated)

5. **Setup frontend .env file**
   - `cp packages/frontend/.env.example packages/frontend/.env`

### Start Development Environment

```bash
# Install dependencies
pnpm install

cd packages/backend

# Start Postgres, Redis, and MongoDB
docker compose up -d

# Run database migrations
pnpm prisma migrate dev

# Start all services
cd ../..
pnpm dev
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api

### System Monitoring Configuration

The monitoring system comes with sensible defaults, but you may want to adjust thresholds:

```typescript
// Default alert thresholds
const CPU_THRESHOLD = 80; // Percent usage
const MEMORY_THRESHOLD = 85; // Percent usage
const DISK_THRESHOLD = 90; // Percent usage
const ERROR_THRESHOLD = 10; // Errors per minute
```

Customize these values in `packages/backend/src/monitoring/services/system-health.service.ts` or expose them through environment variables for deployment flexibility.

### Types Package

The `@scaffold/types` package contains shared TypeScript types and enums used by both frontend and backend. When making changes to this package, you need to rebuild it to ensure changes are properly reflected throughout the project:

```bash
# Rebuild the types package
pnpm --filter @scaffold/types build

# Or rebuild all packages
pnpm build
```

This is particularly important when modifying enums or interfaces that are used for communication between frontend and backend. After rebuilding, TypeScript will detect the updated types across the project.

For CI/CD environments, ensure your build process includes this step to maintain type safety.

## Deployment Options

Scaffold is designed to be deployment-agnostic. Here are some common deployment options:

### Option 1: Traditional VPS/VM Deployment

1. Clone the repository on your server
2. Run `pnpm install` and `pnpm build`
3. Set up PostgreSQL, Redis, and MongoDB (optional)
4. Configure environment variables
5. Run `pnpm start:prod`

### Option 2: Container-based Deployment

1. Use the example Dockerfile: `cp Dockerfile.example Dockerfile`
2. Build the images:
   - `docker build --target backend -t scaffold-backend .`
   - `docker build --target frontend -t scaffold-frontend .`
3. Deploy PostgreSQL, Redis, and MongoDB (optional) using docker-compose or as managed services
4. Run with docker-compose or Kubernetes

### Option 3: Platform as a Service (PaaS)

#### Railway

1. Connect your repository to Railway
2. Add PostgreSQL, Redis, and MongoDB (optional) services
3. Configure environment variables
4. Deploy both backend and frontend services

#### Render

1. Create a new Web Service pointing to your repository
2. Set the build command: `pnpm install && pnpm build`
3. Set the start command: `cd packages/backend && node dist/main.js`
4. Add PostgreSQL, Redis, and MongoDB (optional) services

#### Vercel (Frontend) + Heroku (Backend)

1. Configure Vercel for the frontend
2. Deploy the backend to Heroku
3. Set up Add-ons for PostgreSQL and Redis on Heroku
4. Connect to a MongoDB Atlas instance if needed

### Required Environment Variables

See `.env.example` files in each package for required environment variables. MongoDB configuration is optional; if not provided, the system will fall back to file-based logging only.

### Security Headers Configuration

The application includes comprehensive security headers configured in `packages/backend/src/main.ts`. Before deploying:

1. **Review CSP settings**: If integrating external APIs or services, add their domains to the `connectSrc` directive:

   ```typescript
   connectSrc: [
     "'self'",
     "https://accounts.google.com",
     "https://api.resend.com",
     "https://your-external-api.com", // Add your APIs here
   ],
   ```

2. **Cross-Origin policies**: The application uses strict Cross-Origin headers for enhanced security. These may need adjustment if you plan to embed content from other origins or integrate with iframe-based services.

3. **HSTS settings**: Production deployments should verify the HSTS configuration matches your domain setup and certificate authority requirements.

## MongoDB Configuration (Optional)

MongoDB is used for structured logging and provides advanced query capabilities, configurable retention periods, and better performance for high-volume logging. If MongoDB is not configured, the system will automatically fall back to file-based logging.

To enable MongoDB:

1. Add MongoDB connection details to your .env file:

```
MONGODB_URI=mongodb://localhost:27017/logging
MONGODB_USER=your_username  # Optional
MONGODB_PASSWORD=your_password  # Optional
```

2. Configure logging retention policies through the Admin UI under System Configuration > Logging Settings.

3. Monitor logs through the Admin UI under Security Logs.

## Error Handling Strategy

Scaffold implements a comprehensive error handling strategy:

- **Standardized Error Types**: All errors are categorized into standardized types (Authentication, Authorization, Validation, Server, Network, Unknown)
- **Request Tracing**: Every request gets a unique request ID that persists across client and server for easy debugging
- **Consistent Error Format**: All API errors follow a standardized format with message, error code, and validation details
- **Smart Retry Logic**: The system intelligently decides which errors to retry based on type and status code
- **User-Friendly Validation**: Field-specific validation errors are displayed inline on forms
- **Contextual Logging**: Errors are logged with detailed context information for troubleshooting

This standardized approach makes error handling more predictable for developers and improves the user experience by providing clear feedback on form validation and system errors.

## Extending the Monitoring System

The monitoring system is designed to be extensible. To add custom metrics:

1. Create a new listener in `packages/backend/src/monitoring/listeners/`
2. Subscribe to relevant events using the `@OnEvent()` decorator
3. Emit notification events when thresholds are exceeded:

```typescript
@Injectable()
export class CustomMetricListener {
  constructor(
    private throttleService: NotificationThrottleService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('custom.metric.exceeded')
  handleMetricExceeded(payload: any) {
    if (!this.throttleService.shouldThrottle('CUSTOM_METRIC_HIGH', 'custom')) {
      this.eventEmitter.emit('notification.send', {
        type: 'CUSTOM_METRIC_HIGH',
        data: {
          description: 'Custom metric exceeded threshold',
          severity: 'high',
          service: 'custom',
          details: payload,
        },
        source: 'custom-metric-listener',
      });
    }
  }
}
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Project Roadmap to v1.0

### Core Functionality (✅ Complete)

**Authentication & Security**

- Authentication system with Google OAuth integration
- Session management with JWT and refresh tokens
- CSRF protection for all endpoints
- Device management with trust status and removal capabilities
- Privacy Policy and Terms of Service templates

**Administration & Monitoring**

- Admin portal with user management
- Advanced logging system with MongoDB integration
- Configurable log retention policies
- Security event monitoring dashboard with filtering and export
- User activity tracking and visualization
- Health monitoring with automated alerts for system metrics and service availability
- Intelligent notification system with email delivery, digests, and customizable preferences

**Developer Experience**

- Type-safe communication between frontend and backend
- API standardization with consistent error handling
- Shared TypeScript types between packages
- Responsive UI components with shadcn/ui and Tailwind

### Required for v1.0

#### Admin Notification System

- [x] Implement real-time security alert notifications for admins using a queue-based approach
- [x] Create configurable notification thresholds for system metrics (CPU, memory, disk)
- [x] Add email notification capabilities for critical security events
- [x] Develop notification preferences management UI
- [x] Implement notification digest options (real-time, hourly, daily summary)
- [x] Create notification display for admin dashboard
- [x] Add intelligent throttling to prevent notification storms
- [x] Implement fallback notification paths for critical system failures
- [ ] Add webhook support for integration with external monitoring systems
- [ ] Implement read/unread status tracking for notifications

#### Testing

- [ ] Increase unit test coverage for auth services to >80%
- [ ] Add integration tests for critical API endpoints
- [x] Implement E2E tests for login and admin flows
- [x] E2E tests for rate limiting
- [ ] Add comprehensive tests for health monitoring and notification systems

#### Documentation

- [ ] Complete API documentation with Swagger
- [ ] Add detailed setup and configuration guides
- [ ] Document security features and best practices
- [ ] Create example implementations and customization guides

#### CI/CD & DevOps

- [ ] Add GitHub Actions workflows for testing
- [ ] Create Docker and Docker Compose production setup
- [ ] Add deployment guides for common platforms

#### Performance & Security

- [x] Implement rate limiting for auth endpoints
- [x] Add advanced CSP headers
- [ ] Complete security audit
- [ ] Enable database query optimization

#### Configuration

- [x] Validate all required environment variables on startup
- [x] Document configuration options
- [x] Provide sensible defaults where possible

### Future Enhancements (v1.x)

- Additional authentication providers (Microsoft, GitHub)
- User notification system
- User roles and permissions system
- Enhanced mobile support
- Internationalization (i18n) support for multilingual deployments
- Advanced device fingerprinting for better recognition
- Suspicious login detection based on device patterns
- Customizable device naming for users
- Device-based access control policies
- Geolocation-based device security rules
