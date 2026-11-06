import type { Permission } from './permissions';

export type DistributionType = 'STRICT_PRIVATE' | 'SERVER_PROTECTED';
export type LicenseStatus = 'active' | 'pending' | 'suspended' | 'revoked' | 'expired';
export type LicenseType = 'perpetual' | 'subscription' | 'trial';
export type SubjectType = 'user' | 'group';
export type GroupPolicy = 'deny' | 'owner_match' | 'group_license';
export type ProductStatus = 'draft' | 'active' | 'archived';
export type CustomerStatus = 'active' | 'suspended';
export type ScanStatus = 'pending' | 'clean' | 'warning' | 'rejected';
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export const LICENSE_STATUSES: LicenseStatus[] = ['active', 'pending', 'suspended', 'revoked', 'expired'];

export const LICENSE_EVENT_TYPES = [
  'created',
  'activated',
  'activation_failed',
  'validated',
  'revoked',
  'suspended',
  'reinstated',
  'transferred',
  'binding_reset',
  'expired',
  'session_terminated',
  'credential_rotated',
  'deleted',
] as const;
export type LicenseEventType = (typeof LICENSE_EVENT_TYPES)[number];

export type ActorType = 'user' | 'bot' | 'api_key' | 'runtime' | 'system' | 'platform_admin';

export interface ProductPolicy {
  /** How long a runtime session is valid without a heartbeat (seconds). */
  session_lease_seconds: number;
  /** How often the loader renews its session (seconds). */
  heartbeat_interval_seconds: number;
  /** Maximum simultaneous servers per license. 0 = unlimited. */
  max_concurrent_sessions: number;
  /** How group-owned experiences are licensed. */
  group_policy: GroupPolicy;
  /** Allow Roblox Studio test sessions (no trusted Roblox-Id header). */
  allow_studio: boolean;
  /** Lock the license to the first experience (universe) it activates in. */
  bind_experience_on_first_use: boolean;
  /** Maximum number of transfers. -1 = unlimited. */
  max_transfers: number;
  /** Default license duration for new keys, in days. null = perpetual. */
  default_license_days: number | null;
}

export const DEFAULT_PRODUCT_POLICY: ProductPolicy = {
  session_lease_seconds: 300,
  heartbeat_interval_seconds: 60,
  max_concurrent_sessions: 0,
  group_policy: 'owner_match',
  allow_studio: true,
  bind_experience_on_first_use: false,
  max_transfers: 3,
  default_license_days: null,
};

export interface OperationField {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  required?: boolean;
  max_length?: number;
  min?: number;
  max?: number;
}

export interface RuntimeOperation {
  name: string;
  description?: string;
  /** Whether the public client adapter may request this operation (via the server). */
  client_callable: boolean;
  rate_limit_per_minute: number;
  fields: OperationField[];
}

export interface UserDTO {
  id: string;
  discord_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_platform_admin: boolean;
  created_at: string;
}

export interface StoreSettings {
  notification_channel_id: string | null;
  notify_on: { activation: boolean; revocation: boolean; transfer: boolean; security: boolean };
  webhook_url: string | null;
  require_reason_for_revoke: boolean;
  default_policy: ProductPolicy;
  support_url: string | null;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  notification_channel_id: null,
  notify_on: { activation: false, revocation: true, transfer: true, security: true },
  webhook_url: null,
  require_reason_for_revoke: false,
  default_policy: DEFAULT_PRODUCT_POLICY,
  support_url: null,
};

export interface StoreSummaryDTO {
  id: string;
  name: string;
  slug: string;
  discord_guild_id: string;
  guild_name: string | null;
  guild_icon_url: string | null;
  status: 'active' | 'suspended';
  role: 'owner' | 'admin';
  permissions: Permission[];
  created_at: string;
}

export interface StoreDTO extends StoreSummaryDTO {
  description: string | null;
  owner: { discord_id: string; username: string | null };
  settings: StoreSettings;
}

export interface ScanFinding {
  severity: 'info' | 'warning' | 'critical';
  rule: string;
  message: string;
  location?: string;
}

export interface VersionDTO {
  id: string;
  product_id: string;
  version: string;
  file_name: string;
  file_size: number;
  sha256: string;
  content_type: string;
  scan_status: ScanStatus;
  scan_findings: ScanFinding[];
  changelog: string | null;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
}

export interface ProductDTO {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  distribution_type: DistributionType;
  status: ProductStatus;
  policy: ProductPolicy;
  runtime_endpoint: string | null;
  operations: RuntimeOperation[];
  current_version: VersionDTO | null;
  license_count: number;
  active_license_count: number;
  created_at: string;
  updated_at: string;
}

export interface LicenseDTO {
  id: string;
  store_id: string;
  product_id: string;
  product_name: string | null;
  customer_id: string | null;
  token_hint: string;
  subject_type: SubjectType;
  roblox_user_id: string | null;
  roblox_group_id: string | null;
  roblox_username: string | null;
  status: LicenseStatus;
  license_type: LicenseType;
  created_at: string;
  expires_at: string | null;
  activated_at: string | null;
  last_validated_at: string | null;
  transfer_count: number;
  experience_restriction: string | null;
  bound_universe_id: string | null;
  notes: string | null;
  active_sessions: number;
}

export interface IssuedLicenseDTO extends LicenseDTO {
  /** Full credential. Returned exactly once — Cipher stores only its SHA-256 hash. */
  token: string;
}

export interface LicenseEventDTO {
  id: string;
  license_id: string;
  product_id: string | null;
  product_name?: string | null;
  type: LicenseEventType;
  actor_type: ActorType;
  actor_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SecurityEventDTO {
  id: string;
  store_id: string | null;
  severity: Severity;
  type: string;
  license_id: string | null;
  product_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
}

export interface CustomerDTO {
  id: string;
  store_id: string;
  roblox_user_id: string;
  roblox_username: string | null;
  discord_user_id: string | null;
  status: CustomerStatus;
  notes: string | null;
  created_at: string;
  license_count: number;
  active_license_count: number;
  last_activation_at: string | null;
}

export interface CustomerDetailDTO extends CustomerDTO {
  licenses: LicenseDTO[];
  events: LicenseEventDTO[];
  security_events: SecurityEventDTO[];
}

export interface AuditLogDTO {
  id: string;
  store_id: string | null;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PermissionGroupDTO {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  role_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface DiscordRoleDTO {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface DiscordChannelDTO {
  id: string;
  name: string;
  type: number;
}

export interface ApiKeyDTO {
  id: string;
  name: string;
  prefix: string;
  permissions: Permission[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface MeDTO {
  user: UserDTO;
  stores: StoreSummaryDTO[];
  environment: 'development' | 'production';
}

export interface SessionDTO {
  id: string;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
  current: boolean;
}

export interface OverviewDTO {
  totals: {
    products: number;
    active_licenses: number;
    pending_licenses: number;
    suspended_licenses: number;
    revoked_licenses: number;
    expired_licenses: number;
    customers: number;
    live_sessions: number;
  };
  /** Change versus the previous 30 day window, in percent. null when there is no baseline. */
  deltas: { products: number | null; active_licenses: number | null; revoked_licenses: number | null; customers: number | null };
  activations_by_day: { date: string; activations: number; failures: number }[];
  timeline: LicenseEventDTO[];
  recent_activations: LicenseEventDTO[];
  recent_revocations: LicenseEventDTO[];
  security_events: SecurityEventDTO[];
  product_activity: AuditLogDTO[];
}

export interface RedeemResultDTO {
  store: { name: string; support_url: string | null };
  product: { id: string; name: string; description: string | null; distribution_type: DistributionType; version: string | null; icon_url: string | null };
  license: { id: string; status: LicenseStatus; expires_at: string | null; subject_type: SubjectType; roblox_user_id: string | null; roblox_group_id: string | null };
  secret_name: string;
  downloads: { kind: 'loader' | 'product'; label: string; file_name: string; url: string; expires_at: string }[];
}

/* ---------- Runtime (Roblox loader <-> Cipher) ---------- */

export interface RuntimeServerInfo {
  place_id: string;
  game_id: string;
  creator_id: string;
  creator_type: 'User' | 'Group';
  job_id: string;
  is_studio: boolean;
}

export interface RuntimeGrant {
  authorized: true;
  product_id: string;
  license_id: string;
  session_id: string;
  session_token: string;
  lease_expires_at: number;
  heartbeat_interval: number;
  server_time: number;
  nonce: string;
  operations: string[];
  client_operations: string[];
  /** Ed25519 signature (base64url) over the canonical JSON of the grant without `session_token` and `signature`. */
  signature: string;
  key_id: string;
}

export interface RuntimeDenial {
  authorized: false;
  code: string;
  message: string;
  nonce?: string;
  server_time: number;
}
