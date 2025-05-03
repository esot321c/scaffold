# Scaffold

> An open-source TypeScript foundation for modern web applications.

Scaffold is a production-ready, authentication-first foundation for building modern web applications. It combines the power of NestJS on the backend with Tanstack Router and shadcn/ui on the frontend to provide a complete, type-safe development experience.

## Architecture Decisions

- **Monorepo Structure**: A monorepo approach was chosen to enable sharing TypeScript types between frontend and backend, ensuring complete type safety across the application boundary. This could be broken into separate repos, and the types package could be published as an npm package or hosted in a private package registry (like GitHub Packages, Azure Artifacts, or Nexus Repository) if needed. The monorepo approach simplifies development workflow and ensures types stay in sync during rapid development, while still allowing for future separation if organizational needs require it.
- **Separate Frontend/Backend**: Rather than using a serverless web app, this architecture provides the flexibility to run background jobs, notification systems, and cron tasks. It also supports multiple client applications (web, Android, iOS) sharing the same backend API.
- **NestJS for Backend**: Provides a structured, modular architecture with dependency injection, making the codebase maintainable and testable. The patterns established here could be implemented in other backend languages like C#/.NET, Rust, or Go if team expertise or performance requirements change in the future.
- **PostgreSQL with Prisma**: Offers type-safe database access with migrations, ensuring data integrity and developer productivity.
- **Redis for Caching**: The system includes Redis infrastructure for performance optimization, allowing efficient caching of external API responses, expensive database queries, or other frequently accessed data. This caching layer can significantly reduce latency and minimize costs when integrating with rate-limited or pay-per-call third-party services.
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
- **Modern Stack**: NestJS, Tanstack Router, Prisma, shadcn/ui, Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Docker and Docker Compose (for local database)

### Setup

```bash
# Clone the repository
git clone https://github.com/esot321c/scaffold
cd scaffold

# Install dependencies
pnpm install

# Set up environment variables
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

### Environment Configuration

1. **Generate secure passwords for Redis and Postgres**:

```bash
# Generate Redis password
openssl rand -hex 16

# Generate Postgres password
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
# Start Postgres and Redis
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
- Device tracking and management
- Type-safe communication between frontend and backend

### Required for v1.0

#### API Standardization

- [ ] Replace all direct fetch calls with apiClient utility
- [ ] Implement consistent error response handling
- [ ] Add request/response interceptors for common operations

#### Error Handling

- [ ] Create global exception filter for standardized API responses
- [ ] Implement proper validation error formatting
- [ ] Add request ID tracking for error correlation

#### Logging

- [ ] Replace console.log calls with NestJS Logger
- [ ] Implement structured logging format
- [ ] Configure appropriate log levels for different environments

#### Testing

- [ ] Increase unit test coverage for auth services to >80%
- [ ] Add integration tests for critical API endpoints
- [ ] Implement E2E tests for login and admin flows

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

- [ ] Implement rate limiting for auth endpoints
- [ ] Add advanced CSP headers
- [ ] Complete security audit
- [ ] Enable database query optimization

#### Device Management

- [ ] Complete device management UI for user profiles
- [ ] Implement proper device recognition and fingerprinting
- [ ] Add device approval/verification workflow
- [ ] Enhance device-related logging and notifications
- [ ] Build suspicious login detection based on device patterns
- [ ] Create consistent device naming and identification

#### Configuration

- [ ] Validate all required environment variables on startup
- [ ] Document configuration options
- [ ] Provide sensible defaults where possible

### Future Enhancements (v1.x)

- Additional authentication providers (Microsoft, GitHub)
- Improved analytics dashboard
- Notification system
- User roles and permissions system
- Enhanced mobile support
- Self-hosted option documentation
- Internationalization (i18n) support for multilingual deployments
- Advanced metrics and telemetry for production monitoring
- Two-factor authentication options (currently we assume the OAuth providers handle these)
