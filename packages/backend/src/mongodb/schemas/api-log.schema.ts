import { ApiLog } from '@/logging/interfaces/log.types';
import { Schema } from 'mongoose';

export const ApiLogSchema = new Schema<ApiLog>(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    level: { type: String, required: true, index: true },
    message: { type: String, required: true },
    context: { type: String, required: true },
    requestId: { type: String, index: true },
    userId: { type: String, index: true },
    method: String,
    path: String,
    statusCode: Number,
    responseTime: Number,
    ip: String,
    userAgent: String,
    metadata: Object,
  },
  {
    timestamps: false,
    collection: 'api_logs',
  },
);

// Note: TTL index created dynamically in the service
