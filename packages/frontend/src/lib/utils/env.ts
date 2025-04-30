import { z } from "zod";

// Define schema for environment variables
const envSchema = z.object({
  // Required variables
  VITE_API_URL: z.string().url(),

  // Optional variables with defaults
  VITE_APP_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  VITE_ENABLE_ANALYTICS: z.enum(["true", "false"]).default("false"),

  // Other variables as needed
  VITE_AUTH_PROVIDER: z.enum(["google", "linkedin", "microsoft"]).optional(),
});

// Function to validate and get environment variables
export function validateEnv() {
  // For client-side Vite apps, env variables must be prefixed with VITE_
  const env = {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
    VITE_AUTH_PROVIDER: import.meta.env.VITE_AUTH_PROVIDER,
  };

  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join("."));
      console.error("❌ Invalid environment variables:", error.errors);
      throw new Error(
        `Missing or invalid environment variables: ${missingVars.join(", ")}`
      );
    }
    throw error;
  }
}

// Create a type for the validated env
export type Env = z.infer<typeof envSchema>;

// Export validated env for use throughout the app
export const env = validateEnv();
