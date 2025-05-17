// This file runs before each test file
export default async () => {
  // Global test setup can go here
  // For example, setting up global mocks or environment variables
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.NODE_ENV = 'test';
};
