# Scaffold

> An open-source TypeScript foundation for modern web applications.

Scaffold is a production-ready, authentication-first foundation for building modern web applications. It combines the power of NestJS on the backend with Tanstack Router and shadcn/ui on the frontend to provide a complete, type-safe development experience.

## Version 0.10.0

This release adds a comprehensive logging system with MongoDB support, an enhanced admin dashboard, and improved security monitoring capabilities.

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

## Features

- **Authentication System**: Complete OAuth integration with session management
- **Security First**: CSRF protection, activity logging, session management
- **Type Safety**: Shared TypeScript types between frontend and backend
- **Admin Dashboard**: Built-in admin controls and security monitoring
- **Advanced Logging**: Configurable logging with MongoDB integration for structured logs and retention policies
- **Modern Stack**: NestJS, Tanstack Router, Prisma, shadcn/ui, Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
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

### Start Development Environment

```bash
# Start Postgres, Redis, and MongoDB
docker-compose up -d

# Run database migrations
pnpm --filter backend db:migrate

# Start development servers
pnpm dev
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api

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

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Project Roadmap to v1.0

### Core Functionality (✅ Complete)

- Authentication system with Google OAuth
- Session management with JWT and refresh tokens
- CSRF protection for all endpoints
- Comprehensive activity and security logging
- Admin portal with user management
- Type-safe communication between frontend and backend
- API Standardization with consistent error handling

### Added in v0.10.0 (✅ Complete)

- Advanced logging system with MongoDB integration
- Configurable log retention policies
- Security event monitoring dashboard
- Advanced filtering and export capabilities for logs
- User activity tracking and visualization

### Required for v1.0

#### Device Management

- [ ] Complete device management UI for user profiles
- [ ] Implement proper device recognition and fingerprinting
- [ ] Add device approval/verification workflow
- [ ] Enhance device-related logging and notifications
- [ ] Build suspicious login detection based on device patterns
- [ ] Create consistent device naming and identification

#### Admin Notification System

- [ ] Implement real-time security alert notifications for admins, using a queue-based approach to avoid impacting request performance
- [ ] Create configurable notification thresholds (login failures, suspicious activity)
- [ ] Add email notification capabilities for critical security events
- [ ] Develop notification preferences management UI
- [ ] Implement notification digest options (real-time, hourly, daily summary)
- [ ] Create in-app notification center for viewing alert history
- [ ] Add webhook support for integration with external monitoring systems
- [ ] Implement read/unread status tracking for notifications

#### Testing

- [ ] Increase unit test coverage for auth services to >80%
- [ ] Add integration tests for critical API endpoints
- [ ] Implement E2E tests for login and admin flows

#### Documentation

- [x] Complete API documentation with Swagger
- [ ] Add detailed setup and configuration guides
- [x] Document security features and best practices
- [ ] Create example implementations and customization guides

#### CI/CD & DevOps

- [ ] Add GitHub Actions workflows for testing
- [ ] Create Docker and Docker Compose production setup
- [ ] Add deployment guides for common platforms

#### Performance & Security

- [ ] Implement rate limiting for auth endpoints
- [ ] Add advanced CSP headers
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
