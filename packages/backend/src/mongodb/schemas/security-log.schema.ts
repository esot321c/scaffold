import { SecurityLog } from '@/logging/interfaces/log.types';
import { Schema } from 'mongoose';

export const SecurityLogSchema = new Schema<SecurityLog>(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    level: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    event: { type: String, required: true, index: true },
    success: { type: Boolean, required: true, index: true },
    ipAddress: String,
    userAgent: String,
    deviceId: String,
    sessionId: String,
    requestId: String,
    details: Object,
  },
  {
    timestamps: false,
    collection: 'security_logs',
  },
);

// Note: TTL index created dynamically in the service
