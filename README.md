# Scaffold

> An open-source TypeScript foundation for modern web applications.

Scaffold is a production-ready, authentication-first foundation for building modern web applications. It combines the power of NestJS on the backend with Tanstack Router and shadcn/ui on the frontend to provide a complete, type-safe development experience.

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

## Documentation

Comprehensive documentation coming soon.

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.