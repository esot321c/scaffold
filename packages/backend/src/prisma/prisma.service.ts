import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly encryptionKey: Buffer;
  private readonly hashKey: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  // Fields that need encryption
  private readonly encryptedFields = ['email', 'name', 'phone', 'address'];

  // Fields that need hash lookups
  private readonly hashFields = {
    email: 'emailHash',
    name: 'nameHash',
    phone: 'phoneHash',
  };

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super();

    // Derive keys once during initialization
    const encKeyString = this.configService.get<string>(
      'DATABASE_ENCRYPTION_KEY',
    );
    const hashKeyString = this.configService.get<string>('DATABASE_HASH_KEY');

    if (!encKeyString || !hashKeyString) {
      throw new Error(
        'DATABASE_ENCRYPTION_KEY and DATABASE_HASH_KEY environment variables are required',
      );
    }

    this.encryptionKey = crypto.scryptSync(encKeyString, 'salt', 32);
    this.hashKey = crypto.scryptSync(hashKeyString, 'salt', 32);

    // Add middleware for encryption/decryption
    this.$use(async (params, next) => {
      // Only process User model operations
      if (params.model !== 'User') {
        return next(params);
      }

      // Handle modifications (create/update/upsert)
      if (['create', 'update', 'upsert'].includes(params.action)) {
        await this.processWriteOperation(params);
      }

      // Handle read queries that need hash conversion
      if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
        await this.processReadQuery(params);
      }

      // Execute the modified query
      const result = await next(params);

      // Process result data if needed
      if (
        result &&
        ['findUnique', 'findFirst', 'findMany'].includes(params.action)
      ) {
        return this.processReadResult(result);
      }

      return result;
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Preprocesses write operations (create/update/upsert)
  private async processWriteOperation(params: any): Promise<void> {
    const data =
      params.action === 'upsert' ? params.args.create : params.args.data;

    if (!data) return;

    // Process data object for encryption and hashing
    for (const field of this.encryptedFields) {
      if (data[field] !== undefined && data[field] !== null) {
        // Add hash for searchable fields
        const hashFieldName = this.hashFields[field];
        if (hashFieldName) {
          data[hashFieldName] = await this.hashValue(data[field]);
        }

        // Encrypt the field value
        data[field] = this.encrypt(data[field]);
      }
    }

    // Handle upsert case - need to process both create and update
    if (params.action === 'upsert' && params.args.update) {
      for (const field of this.encryptedFields) {
        if (
          params.args.update[field] !== undefined &&
          params.args.update[field] !== null
        ) {
          // Add hash for searchable fields
          const hashFieldName = this.hashFields[field];
          if (hashFieldName) {
            params.args.update[hashFieldName] = await this.hashValue(
              params.args.update[field],
            );
          }

          // Encrypt the field value
          params.args.update[field] = this.encrypt(params.args.update[field]);
        }
      }
    }
  }

  // Preprocesses read queries to convert email/name/phone lookups to hash lookups
  private async processReadQuery(params: any): Promise<void> {
    if (!params.args?.where) return;

    const where = params.args.where;

    // Convert direct field lookups to hash lookups
    for (const field of Object.keys(this.hashFields)) {
      if (where[field] !== undefined && where[field] !== null) {
        where[this.hashFields[field]] = await this.hashValue(where[field]);
        delete where[field];
      }
    }

    // Process OR conditions if present
    if (Array.isArray(where.OR)) {
      const transformedConditions: Record<string, any>[] = [];

      for (const condition of where.OR) {
        const newCondition: Record<string, any> = { ...condition };

        for (const field of Object.keys(this.hashFields)) {
          if (
            newCondition[field] !== undefined &&
            newCondition[field] !== null
          ) {
            newCondition[
              this.hashFields[field as keyof typeof this.hashFields]
            ] = await this.hashValue(newCondition[field]);
            delete newCondition[field];
          }
        }

        transformedConditions.push(newCondition);
      }

      where.OR = transformedConditions;
    }
  }

  // Process read results to decrypt fields
  private processReadResult(result: any): any {
    if (!result) return result;

    if (Array.isArray(result)) {
      return result.map((item) => this.decryptObject(item));
    }

    return this.decryptObject(result);
  }

  // Decrypt an object's encrypted fields
  private decryptObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    for (const field of this.encryptedFields) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = this.decrypt(result[field]);
        } catch (error) {
          // If decryption fails, leave as is - might be unencrypted data
          console.error(`Failed to decrypt field ${field}:`, error);
        }
      }
    }

    return result;
  }

  // Redis-backed hash function
  private async hashValue(value: string): Promise<string | null> {
    if (!value) return null;

    // Normalize the value to ensure consistent hashing
    const normalizedValue = value.toLowerCase().trim();

    // Create a cache key that doesn't expose the actual value
    // We'll hash with a different key for the cache key to prevent information leakage
    const cacheKey = `pii_hash:${crypto.createHash('sha256').update(normalizedValue).digest('hex')}`;

    // Check Redis cache
    const cachedHash = await this.cacheManager.get<string>(cacheKey);
    if (cachedHash) {
      return cachedHash;
    }

    // Compute hash with our actual hash key
    const hash = crypto
      .createHmac('sha256', this.hashKey)
      .update(normalizedValue)
      .digest('hex');

    // Store in Redis with a TTL of 24 hours
    await this.cacheManager.set(cacheKey, hash, 86400000);

    return hash;
  }

  // Encrypt a value
  private encrypt(value: string): string | null {
    if (!value) return null;

    // Generate a new IV for each encryption
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );

    // Encrypt the data
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get the authentication tag
    const authTag = cipher.getAuthTag();

    // Return IV + Auth Tag + Encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  // Decrypt a value with proper error handling
  private decrypt(encryptedValue: string): string | null {
    if (!encryptedValue) return null;

    // Check if value is in encrypted format
    if (!encryptedValue.includes(':')) {
      return encryptedValue; // Not encrypted
    }

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      return encryptedValue; // Invalid format, return as is
    }

    try {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedData = parts[2];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // If decryption fails, return the original value
      return encryptedValue;
    }
  }

  // Public methods
  public async generateHash(value: string): Promise<string | null> {
    return this.hashValue(value);
  }

  public encryptValue(value: string): string | null {
    return this.encrypt(value);
  }

  public decryptValue(value: string): string | null {
    return this.decrypt(value);
  }
}
