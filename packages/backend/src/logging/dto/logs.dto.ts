import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsBoolean,
  IsDate,
  IsIn,
} from 'class-validator';
import {
  AuthEventType,
  SecurityLog,
  ApiLog,
  LogRetentionSettings,
  PaginatedResponse,
} from '@scaffold/types';

// Base pagination for all log queries
export class PaginationQueryDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 50,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 50;
}

// Security logs query
export class SecurityLogQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by specific user ID',
    example: 'user-123',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'User ID must be a string' })
  userId?: string;

  @ApiProperty({
    description: 'Filter by event type',
    enum: AuthEventType,
    example: AuthEventType.LOGIN,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuthEventType, { message: 'Event must be a valid AuthEventType' })
  event?: AuthEventType;

  @ApiProperty({
    description: 'Filter by success status',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'Success must be a boolean value' })
  success?: boolean;

  @ApiProperty({
    description: 'Search in IP address, user agent, or session details',
    example: '192.168.1.1',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  search?: string;

  @ApiProperty({
    description: 'Start date for filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'From date must be a valid date' })
  from?: Date;

  @ApiProperty({
    description: 'End date for filtering (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'To date must be a valid date' })
  to?: Date;
}

// API logs query
export class ApiLogQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by API path',
    example: '/users',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Path must be a string' })
  path?: string;

  @ApiProperty({
    description: 'Filter by HTTP method',
    example: 'POST',
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    required: false,
  })
  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
    message: 'Method must be a valid HTTP method',
  })
  method?: string;

  @ApiProperty({
    description: 'Filter by HTTP status code',
    example: 500,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Status code must be an integer' })
  @Min(100, { message: 'Status code must be at least 100' })
  @Max(599, { message: 'Status code must be at most 599' })
  statusCode?: number;

  @ApiProperty({
    description: 'Filter by specific user ID',
    example: 'user-123',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'User ID must be a string' })
  userId?: string;

  @ApiProperty({
    description: 'Search in path, IP address, or user agent',
    example: 'admin',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  search?: string;

  @ApiProperty({
    description: 'Start date for filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'From date must be a valid date' })
  from?: Date;

  @ApiProperty({
    description: 'End date for filtering (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'To date must be a valid date' })
  to?: Date;
}

// Log export query
export class LogExportQueryDto {
  @ApiProperty({
    description: 'Type of logs to export',
    enum: ['security', 'api'],
    example: 'security',
  })
  @IsEnum(['security', 'api'], {
    message: 'Type must be either "security" or "api"',
  })
  type: 'security' | 'api';

  @ApiProperty({
    description: 'Export format',
    enum: ['csv'],
    default: 'csv',
    required: false,
  })
  @IsOptional()
  @IsEnum(['csv'], { message: 'Format must be "csv"' })
  format?: 'csv' = 'csv';

  @ApiProperty({
    description: 'Filter by event type (security logs only)',
    enum: AuthEventType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AuthEventType)
  event?: AuthEventType;

  @ApiProperty({
    description: 'Filter by success status',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  success?: boolean;

  @ApiProperty({
    description: 'Filter by specific user ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Search term',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Start date for filtering (ISO string)',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiProperty({
    description: 'End date for filtering (ISO string)',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiProperty({
    description: 'HTTP method (API logs only)',
    required: false,
  })
  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  @ApiProperty({
    description: 'HTTP status code (API logs only)',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @ApiProperty({
    description: 'API path (API logs only)',
    required: false,
  })
  @IsOptional()
  @IsString()
  path?: string;
}

// Log configuration update
export class LogConfigUpdateDto {
  @ApiProperty({
    description: 'Number of days to retain security logs',
    minimum: 1,
    maximum: 365,
    example: 90,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Security log retention must be an integer' })
  @Min(1, { message: 'Security log retention must be at least 1 day' })
  @Max(365, { message: 'Security log retention cannot exceed 365 days' })
  securityLogDays?: number;

  @ApiProperty({
    description: 'Number of days to retain API logs',
    minimum: 1,
    maximum: 365,
    example: 30,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'API log retention must be an integer' })
  @Min(1, { message: 'API log retention must be at least 1 day' })
  @Max(365, { message: 'API log retention cannot exceed 365 days' })
  apiLogDays?: number;

  @ApiProperty({
    description: 'Enable MongoDB for structured logging',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'MongoDB enabled must be a boolean value' })
  mongoEnabled?: boolean;

  @ApiProperty({
    description: 'Enable file-based logging',
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsBoolean({ message: 'File enabled must be a boolean value' })
  fileEnabled?: boolean;
}

// Response DTOs for Swagger documentation
export class SecurityLogResponseDto implements PaginatedResponse<SecurityLog> {
  @ApiProperty({
    type: [Object],
    description: 'Array of security logs',
  })
  data: SecurityLog[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      type: 'offset',
      total: 100,
      page: 1,
      limit: 50,
      pages: 2,
    },
  })
  pagination: {
    type: 'offset';
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class ApiLogResponseDto implements PaginatedResponse<ApiLog> {
  @ApiProperty({
    type: [Object],
    description: 'Array of API logs',
  })
  data: ApiLog[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      type: 'offset',
      total: 100,
      page: 1,
      limit: 50,
      pages: 2,
    },
  })
  pagination: {
    type: 'offset';
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class LogConfigResponseDto implements LogRetentionSettings {
  @ApiProperty({
    example: 90,
    description: 'Number of days to retain security logs',
  })
  securityLogDays: number;

  @ApiProperty({
    example: 30,
    description: 'Number of days to retain API logs',
  })
  apiLogDays: number;

  @ApiProperty({
    example: true,
    description: 'Whether MongoDB logging is enabled',
  })
  mongoEnabled: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether file logging is enabled',
  })
  fileEnabled: boolean;
}
