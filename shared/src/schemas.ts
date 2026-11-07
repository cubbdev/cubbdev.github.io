import { z } from 'zod';
import { PERMISSIONS } from './permissions';

/** Roblox numeric IDs are transported as decimal strings to avoid float precision loss. */
export const robloxId = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^[1-9][0-9]{0,18}$/.test(v), 'Must be a positive Roblox numeric ID');

export const snowflake = z.string().regex(/^[0-9]{5,25}$/, 'Must be a Discord ID');
export const idParam = z.string().regex(/^[a-z]{2,5}_[A-Za-z0-9]{8,40}$/, 'Malformed identifier');

export const permissionSchema = z.enum(PERMISSIONS);

export const productPolicySchema = z.object({
  session_lease_seconds: z.number().int().min(120).max(1800),
  heartbeat_interval_seconds: z.number().int().min(30).max(600),
  max_concurrent_sessions: z.number().int().min(0).max(10000),
  group_policy: z.enum(['deny', 'owner_match', 'group_license']),
  allow_studio: z.boolean(),
  bind_experience_on_first_use: z.boolean(),
  max_transfers: z.number().int().min(-1).max(1000),
  default_license_days: z.number().int().min(1).max(3650).nullable(),
}).refine((p) => p.heartbeat_interval_seconds * 2 <= p.session_lease_seconds, {
  message: 'Heartbeat interval must be at most half of the session lease',
  path: ['heartbeat_interval_seconds'],
});

export const operationFieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/),
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  required: z.boolean().optional(),
  max_length: z.number().int().min(1).max(4096).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const runtimeOperationSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,30}(\.[a-z][a-z0-9_]{0,30}){0,3}$/, 'Use dotted lowercase names, e.g. vehicle.spawn'),
  description: z.string().max(300).optional(),
  client_callable: z.boolean().default(false),
  rate_limit_per_minute: z.number().int().min(1).max(6000).default(120),
  fields: z.array(operationFieldSchema).max(32).default([]),
});

const httpsUrl = z
  .string()
  .url()
  .max(500)
  .refine((u) => u.startsWith('https://'), 'Must be an https:// URL');

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  distribution_type: z.enum(['STRICT_PRIVATE', 'SERVER_PROTECTED']),
  policy: productPolicySchema.optional(),
  runtime_endpoint: httpsUrl.optional().nullable(),
  operations: z.array(runtimeOperationSchema).max(64).optional(),
  advanced_security: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  policy: productPolicySchema.optional(),
  runtime_endpoint: httpsUrl.optional().nullable(),
  operations: z.array(runtimeOperationSchema).max(64).optional(),
  advanced_security: z.boolean().optional(),
});

export const createLicenseSchema = z
  .object({
    product_id: idParam,
    subject_type: z.enum(['user', 'group']).default('user'),
    roblox_user_id: robloxId.optional().nullable(),
    roblox_group_id: robloxId.optional().nullable(),
    license_type: z.enum(['perpetual', 'subscription', 'trial']).default('perpetual'),
    expires_in_days: z.number().int().min(1).max(3650).optional().nullable(),
    experience_restriction: robloxId.optional().nullable(),
    discord_user_id: snowflake.optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine((v) => (v.subject_type === 'user' ? !!v.roblox_user_id : !!v.roblox_group_id), {
    message: 'A Roblox user ID (or group ID for group licenses) is required',
    path: ['roblox_user_id'],
  });

export const revokeLicenseSchema = z.object({ reason: z.string().trim().max(300).optional().nullable() });
export const transferLicenseSchema = z.object({
  roblox_user_id: robloxId,
  confirm: z.literal(true, { errorMap: () => ({ message: 'Transfers must be explicitly confirmed' }) }),
  reason: z.string().trim().max(300).optional().nullable(),
});
export const confirmSchema = z.object({ confirm: z.literal(true, { errorMap: () => ({ message: 'This action must be explicitly confirmed' }) }), reason: z.string().max(300).optional().nullable() });

export const licenseQuerySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(['active', 'pending', 'suspended', 'revoked', 'expired']).optional(),
  product_id: idParam.optional(),
  customer_id: idParam.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['created_at', 'last_validated_at', 'expires_at', 'status']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const storeSettingsSchema = z.object({
  notification_channel_id: snowflake.nullable(),
  notify_on: z.object({ activation: z.boolean(), revocation: z.boolean(), transfer: z.boolean(), security: z.boolean() }),
  webhook_url: httpsUrl.nullable(),
  require_reason_for_revoke: z.boolean(),
  default_policy: productPolicySchema,
  support_url: httpsUrl.nullable(),
});

export const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  settings: storeSettingsSchema.partial().optional(),
});

export const permissionGroupSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.array(permissionSchema).max(32),
  role_ids: z.array(snowflake).max(25),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(40),
  permissions: z.array(permissionSchema).min(1).max(32),
});

export const installIntentSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

/* ---------- Runtime ---------- */

export const runtimeServerSchema = z.object({
  place_id: robloxId.or(z.literal('0')),
  game_id: robloxId.or(z.literal('0')),
  creator_id: robloxId.or(z.literal('0')),
  creator_type: z.enum(['User', 'Group']),
  job_id: z.string().max(64),
  is_studio: z.boolean(),
});

const nonceSchema = z.string().min(16).max(64).regex(/^[A-Za-z0-9-_{}]+$/);

export const activateSchema = z.object({
  product_id: idParam,
  loader_version: z.string().max(20).optional(),
  product_version: z.string().max(40).optional(),
  nonce: nonceSchema,
  timestamp: z.number().int(),
  server: runtimeServerSchema,
  /** Advanced Security: fingerprint of the package's instance tree, computed by the loader. */
  package: z.object({ fingerprint: z.string().regex(/^[0-9a-f]{16}$/), items: z.number().int().min(0).max(1_000_000) }).optional(),
});

export const heartbeatSchema = z.object({
  session_id: idParam,
  session_token: z.string().min(20).max(100),
  nonce: nonceSchema,
  timestamp: z.number().int(),
});

export const invokeSchema = z.object({
  session_id: idParam,
  session_token: z.string().min(20).max(100),
  operation: z.string().max(130),
  // Roblox's JSONEncode serialises an empty table as [], so normalise it to {}.
  payload: z.preprocess((v) => (Array.isArray(v) && v.length === 0 ? {} : v ?? {}), z.record(z.unknown())),
  player_user_id: robloxId.optional().nullable(),
  via_client: z.boolean().default(false),
  nonce: nonceSchema,
  timestamp: z.number().int(),
});

export const redeemSchema = z.object({ token: z.string().trim().min(20).max(120) });

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type CreateLicenseInput = z.input<typeof createLicenseSchema>;
export type LicenseQuery = z.input<typeof licenseQuerySchema>;
export type PermissionGroupInput = z.input<typeof permissionGroupSchema>;
export type UpdateStoreInput = z.input<typeof updateStoreSchema>;
export type ActivateInput = z.infer<typeof activateSchema>;
