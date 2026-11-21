import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
    HOST: z.string().default('0.0.0.0'),
    TURSO_DATABASE_URL: z.string().optional(),
    TURSO_AUTH_TOKEN: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().default('dev-jwt-secret-fieldlog-sitesaathi-test-key-32'),
    STORAGE_PROVIDER: z.enum(['local', 'r2', 's3']).default('local'),
    LOCAL_STORAGE_PATH: z.string().default('./uploads'),
    // Cloudflare R2 / S3
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_PUBLIC_DOMAIN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.TURSO_DATABASE_URL && !data.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['TURSO_DATABASE_URL'],
          message: 'TURSO_DATABASE_URL is strictly required in production',
        });
      }
      if (!data.JWT_SECRET || data.JWT_SECRET === 'dev-jwt-secret-fieldlog-sitesaathi-test-key-32') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message: 'Secure JWT_SECRET must be explicitly set in production',
        });
      }
      if (data.STORAGE_PROVIDER === 'r2' || data.STORAGE_PROVIDER === 's3') {
        if (!data.R2_ACCESS_KEY_ID) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['R2_ACCESS_KEY_ID'],
            message: 'R2_ACCESS_KEY_ID is required when STORAGE_PROVIDER=r2',
          });
        }
        if (!data.R2_SECRET_ACCESS_KEY) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['R2_SECRET_ACCESS_KEY'],
            message: 'R2_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=r2',
          });
        }
        if (!data.R2_BUCKET_NAME) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['R2_BUCKET_NAME'],
            message: 'R2_BUCKET_NAME is required when STORAGE_PROVIDER=r2',
          });
        }
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment configuration validation failed:');
    for (const issue of error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    parsedEnv = {
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      PORT: parseInt(process.env.PORT || '4000', 10),
      HOST: process.env.HOST || '0.0.0.0',
      JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-fieldlog-sitesaathi-test-key-32',
      STORAGE_PROVIDER: (process.env.STORAGE_PROVIDER as any) || 'local',
      LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || './uploads',
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
      DATABASE_URL: process.env.DATABASE_URL,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN,
    };
  } else {
    throw error;
  }
}

export const env = parsedEnv;
