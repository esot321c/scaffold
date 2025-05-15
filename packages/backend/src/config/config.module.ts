import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './configuration';
import { validationSchema } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config: Record<string, unknown>) => {
        const result = validationSchema.safeParse(config);
        if (result.success === false) {
          // Format the error message manually
          const errorMessages = result.error.errors
            .map((err) => `${err.path.join('.')}: ${err.message}`)
            .join('\n');
          throw new Error(`Config validation error:\n${errorMessages}`);
        }
        return result.data;
      },
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      isGlobal: true,
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
