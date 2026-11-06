import { CipherApiError } from './errors';
import { computeServiceSignature, randomNonce, SERVICE_HEADERS } from './service-auth';
import type {
  ApiKeyDTO,
  AuditLogDTO,
  CustomerDTO,
  CustomerDetailDTO,
  DiscordChannelDTO,
  DiscordRoleDTO,
  GamePassDTO,
  IssuedLicenseDTO,
  LicenseDTO,
  LicenseEventDTO,
  MeDTO,
  OverviewDTO,
  Paginated,
  PermissionGroupDTO,
  ProductDTO,
  PurchaseDTO,
  RedeemResultDTO,
  RobloxLinkDTO,
  SalesDTO,
  ShopProductDTO,
  ShopStoreDTO,
  StoreRobloxDTO,
  SecurityEventDTO,
  SessionDTO,
  StoreDTO,
  StoreSummaryDTO,
  VersionDTO,
} from './types';
import type {
  CreateLicenseInput,
  CreateProductInput,
  LicenseQuery,
  PermissionGroupInput,
  UpdateProductInput,
  UpdateStoreInput,
} from './schemas';
import type { Permission } from './permissions';

export interface UploadFile {
  file: Blob;
  fileName: string;
  destination: string;
  scriptType?: 'Script' | 'LocalScript' | 'ModuleScript' | null;
}

export type ClientAuth =
  | { mode: 'browser' }
  | { mode: 'service'; secret: string; actorDiscordId: string; guildId: string }
  | { mode: 'api_key'; key: string };

export interface CipherClientOptions {
  baseUrl: string;
  auth: ClientAuth;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Typed client for the Cipher REST API. Shared by the web dashboard (browser cookie session)
 * and the Discord bot (HMAC-signed service requests) so business logic lives only in the API.
 */
export class CipherClient {
  private readonly baseUrl: string;
  private readonly auth: ClientAuth;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CipherClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.auth = opts.auth;
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
  }

  /** Returns a copy of this client acting for a different Discord user/guild (bot only). */
  withActor(actorDiscordId: string, guildId: string): CipherClient {
    if (this.auth.mode !== 'service') throw new Error('withActor is only available for service clients');
    return new CipherClient({
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
      auth: { ...this.auth, actorDiscordId, guildId },
    });
  }

  url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const pathWithQuery = `/v1${path}${qs(query)}`;
    const headers: Record<string, string> = { accept: 'application/json', 'x-cipher-client': 'cipher-sdk/1' };
    let payload: FormData | string | undefined;
    let rawForSignature: string | Uint8Array = '';

    if (body instanceof FormData) {
      payload = body;
      if (this.auth.mode === 'service') throw new Error('Multipart uploads are not supported for service clients');
    } else if (body !== undefined) {
      rawForSignature = JSON.stringify(body);
      payload = rawForSignature;
      headers['content-type'] = 'application/json';
    }

    if (this.auth.mode === 'service') {
      const ts = String(Math.floor(Date.now() / 1000));
      const nonce = randomNonce();
      headers[SERVICE_HEADERS.timestamp] = ts;
      headers[SERVICE_HEADERS.nonce] = nonce;
      headers[SERVICE_HEADERS.actor] = this.auth.actorDiscordId;
      headers[SERVICE_HEADERS.guild] = this.auth.guildId;
      headers[SERVICE_HEADERS.signature] = await computeServiceSignature(this.auth.secret, ts, nonce, method, pathWithQuery, rawForSignature);
    } else if (this.auth.mode === 'api_key') {
      headers.authorization = `Bearer ${this.auth.key}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      const init: Record<string, unknown> = {
        method,
        headers,
        body: payload,
        credentials: this.auth.mode === 'browser' ? 'include' : 'omit',
        signal: controller.signal,
      };
      res = await this.fetchImpl(`${this.baseUrl}${pathWithQuery}`, init as RequestInit);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new CipherApiError(504, 'timeout', 'The Cipher API did not respond in time. Please try again.');
      }
      throw new CipherApiError(0, 'network_error', 'Could not reach the Cipher API. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const e = (data as { error?: { code?: string; message?: string; details?: unknown; request_id?: string } } | null)?.error;
      throw new CipherApiError(res.status, e?.code ?? 'http_error', e?.message ?? `Request failed with status ${res.status}`, e?.details, e?.request_id);
    }
    return data as T;
  }

  /* ---------------- Auth ---------------- */
  me() { return this.request<MeDTO>('GET', '/auth/me'); }
  exchangeTicket(ticket: string) { return this.request<{ ok: true }>('POST', '/auth/exchange', { ticket }); }
  logout() { return this.request<{ ok: true }>('POST', '/auth/logout', {}); }
  sessions() { return this.request<{ items: SessionDTO[] }>('GET', '/auth/sessions'); }
  revokeSession(id: string) { return this.request<{ ok: true }>('DELETE', `/auth/sessions/${id}`); }
  loginUrl(redirect = '/app') { return this.url(`/v1/auth/discord/start${qs({ redirect })}`); }
  devLoginUrl(username: string, redirect = '/app') { return this.url(`/v1/auth/dev/start${qs({ username, redirect })}`); }

  /* ---------------- Stores ---------------- */
  stores() { return this.request<{ items: StoreSummaryDTO[] }>('GET', '/stores'); }
  store(storeId: string) { return this.request<StoreDTO>('GET', `/stores/${storeId}`); }
  storeByGuild(guildId: string) { return this.request<StoreDTO>('GET', `/stores/by-guild/${guildId}`); }
  updateStore(storeId: string, input: UpdateStoreInput) { return this.request<StoreDTO>('PATCH', `/stores/${storeId}`, input); }
  deleteStore(storeId: string, confirmName: string) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}`, { confirm_name: confirmName }); }
  installIntent(name: string) { return this.request<{ url: string; expires_at: string }>('POST', '/stores/install-intent', { name }); }
  relinkIntent(storeId: string) { return this.request<{ url: string; expires_at: string }>('POST', `/stores/${storeId}/relink-intent`, {}); }
  myPermissions(storeId: string) { return this.request<{ role: 'owner' | 'admin'; permissions: Permission[] }>('GET', `/stores/${storeId}/me`); }
  discordRoles(storeId: string) { return this.request<{ items: DiscordRoleDTO[] }>('GET', `/stores/${storeId}/discord/roles`); }
  discordChannels(storeId: string) { return this.request<{ items: DiscordChannelDTO[] }>('GET', `/stores/${storeId}/discord/channels`); }
  testNotification(storeId: string) { return this.request<{ ok: true }>('POST', `/stores/${storeId}/notifications/test`, {}); }

  permissionGroups(storeId: string) { return this.request<{ items: PermissionGroupDTO[] }>('GET', `/stores/${storeId}/permission-groups`); }
  createPermissionGroup(storeId: string, input: PermissionGroupInput) { return this.request<PermissionGroupDTO>('POST', `/stores/${storeId}/permission-groups`, input); }
  updatePermissionGroup(storeId: string, groupId: string, input: Partial<PermissionGroupInput>) { return this.request<PermissionGroupDTO>('PATCH', `/stores/${storeId}/permission-groups/${groupId}`, input); }
  deletePermissionGroup(storeId: string, groupId: string) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}/permission-groups/${groupId}`); }

  /* ---------------- Products ---------------- */
  products(storeId: string, query?: { status?: string; q?: string }) { return this.request<{ items: ProductDTO[] }>('GET', `/stores/${storeId}/products`, undefined, query); }
  product(storeId: string, productId: string) { return this.request<ProductDTO>('GET', `/stores/${storeId}/products/${productId}`); }
  createProduct(storeId: string, input: CreateProductInput) { return this.request<ProductDTO>('POST', `/stores/${storeId}/products`, input); }
  updateProduct(storeId: string, productId: string, input: UpdateProductInput) { return this.request<ProductDTO>('PATCH', `/stores/${storeId}/products/${productId}`, input); }
  deleteProduct(storeId: string, productId: string) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}/products/${productId}`, { confirm: true }); }
  uploadIcon(storeId: string, productId: string, file: Blob) {
    const fd = new FormData();
    fd.set('file', file);
    return this.request<ProductDTO>('POST', `/stores/${storeId}/products/${productId}/icon`, fd);
  }
  versions(storeId: string, productId: string) { return this.request<{ items: VersionDTO[] }>('GET', `/stores/${storeId}/products/${productId}/versions`); }
  /** One-step asset upload: Cipher creates the product, version 1.0.0, publishes it and builds the package. */
  quickCreateProduct(storeId: string, input: { name: string; description?: string | null; distribution_type: 'STRICT_PRIVATE' | 'SERVER_PROTECTED'; advanced_security?: boolean; icon?: Blob | null; files: UploadFile[] }) {
    const fd = new FormData();
    fd.set('name', input.name);
    if (input.description) fd.set('description', input.description);
    fd.set('distribution_type', input.distribution_type);
    fd.set('advanced_security', input.advanced_security ? 'true' : 'false');
    if (input.icon) fd.set('icon', input.icon);
    for (const f of input.files) fd.append('files', f.file, f.fileName);
    fd.set('manifest', JSON.stringify(input.files.map((f) => ({ destination: f.destination, script_type: f.scriptType ?? null }))));
    return this.request<{ product: ProductDTO; version: VersionDTO }>('POST', `/stores/${storeId}/products/quick`, fd);
  }
  uploadFiles(storeId: string, productId: string, files: UploadFile[], version: string, changelog?: string, publish = true) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f.file, f.fileName);
    fd.set('manifest', JSON.stringify(files.map((f) => ({ destination: f.destination, script_type: f.scriptType ?? null }))));
    fd.set('version', version);
    if (changelog) fd.set('changelog', changelog);
    fd.set('publish', publish ? 'true' : 'false');
    return this.request<VersionDTO>('POST', `/stores/${storeId}/products/${productId}/versions`, fd);
  }
  uploadVersion(storeId: string, productId: string, file: Blob | null, fileName: string, version: string, changelog?: string, publish = true) {
    const fd = new FormData();
    if (file) fd.set('file', file, fileName);
    fd.set('version', version);
    if (changelog) fd.set('changelog', changelog);
    fd.set('publish', publish ? 'true' : 'false');
    return this.request<VersionDTO>('POST', `/stores/${storeId}/products/${productId}/versions`, fd);
  }
  publishVersion(storeId: string, productId: string, versionId: string) { return this.request<ProductDTO>('POST', `/stores/${storeId}/products/${productId}/versions/${versionId}/publish`, {}); }
  productActivity(storeId: string, productId: string) { return this.request<{ items: AuditLogDTO[]; events: LicenseEventDTO[] }>('GET', `/stores/${storeId}/products/${productId}/activity`); }
  integration(storeId: string, productId: string) { return this.request<{ markdown: string; secret_name: string; files: { name: string; class_name: string; source: string }[] }>('GET', `/stores/${storeId}/products/${productId}/integration`); }
  loaderDownloadUrl(storeId: string, productId: string) { return this.url(`/v1/stores/${storeId}/products/${productId}/loader.rbxmx`); }

  /* ---------------- Licenses ---------------- */
  licenses(storeId: string, query?: LicenseQuery) { return this.request<Paginated<LicenseDTO>>('GET', `/stores/${storeId}/licenses`, undefined, query as Query); }
  license(storeId: string, licenseId: string) { return this.request<LicenseDTO>('GET', `/stores/${storeId}/licenses/${licenseId}`); }
  createLicense(storeId: string, input: CreateLicenseInput) { return this.request<IssuedLicenseDTO>('POST', `/stores/${storeId}/licenses`, input); }
  revokeLicense(storeId: string, licenseId: string, reason?: string | null) { return this.request<LicenseDTO>('POST', `/stores/${storeId}/licenses/${licenseId}/revoke`, { reason: reason ?? null }); }
  suspendLicense(storeId: string, licenseId: string, reason?: string | null) { return this.request<LicenseDTO>('POST', `/stores/${storeId}/licenses/${licenseId}/suspend`, { reason: reason ?? null }); }
  reinstateLicense(storeId: string, licenseId: string) { return this.request<LicenseDTO>('POST', `/stores/${storeId}/licenses/${licenseId}/reinstate`, {}); }
  transferLicense(storeId: string, licenseId: string, robloxUserId: string, reason?: string | null) {
    return this.request<LicenseDTO>('POST', `/stores/${storeId}/licenses/${licenseId}/transfer`, { roblox_user_id: robloxUserId, confirm: true, reason: reason ?? null });
  }
  resetBinding(storeId: string, licenseId: string) { return this.request<LicenseDTO>('POST', `/stores/${storeId}/licenses/${licenseId}/reset-binding`, { confirm: true }); }
  rotateLicense(storeId: string, licenseId: string) { return this.request<IssuedLicenseDTO>('POST', `/stores/${storeId}/licenses/${licenseId}/rotate`, { confirm: true }); }
  deleteLicense(storeId: string, licenseId: string, reason?: string | null) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}/licenses/${licenseId}`, { confirm: true, reason: reason ?? null }); }
  licenseHistory(storeId: string, licenseId: string) { return this.request<{ items: LicenseEventDTO[] }>('GET', `/stores/${storeId}/licenses/${licenseId}/history`); }
  lookupLicense(storeId: string, token: string) { return this.request<LicenseDTO>('POST', `/stores/${storeId}/licenses/lookup`, { token }); }

  /* ---------------- Customers ---------------- */
  customers(storeId: string, query?: { q?: string; status?: string; page?: number; page_size?: number }) { return this.request<Paginated<CustomerDTO>>('GET', `/stores/${storeId}/customers`, undefined, query); }
  customer(storeId: string, customerId: string) { return this.request<CustomerDetailDTO>('GET', `/stores/${storeId}/customers/${customerId}`); }
  customerByRoblox(storeId: string, robloxUserId: string) { return this.request<CustomerDetailDTO>('GET', `/stores/${storeId}/customers/by-roblox/${robloxUserId}`); }
  customerByDiscord(storeId: string, discordUserId: string) { return this.request<CustomerDetailDTO>('GET', `/stores/${storeId}/customers/by-discord/${discordUserId}`); }
  updateCustomer(storeId: string, customerId: string, input: { discord_user_id?: string | null; notes?: string | null }) { return this.request<CustomerDTO>('PATCH', `/stores/${storeId}/customers/${customerId}`, input); }
  suspendCustomer(storeId: string, customerId: string, reason?: string | null) { return this.request<CustomerDTO>('POST', `/stores/${storeId}/customers/${customerId}/suspend`, { confirm: true, reason: reason ?? null }); }
  restoreCustomer(storeId: string, customerId: string) { return this.request<CustomerDTO>('POST', `/stores/${storeId}/customers/${customerId}/restore`, {}); }

  /* ---------------- Analytics / audit ---------------- */
  overview(storeId: string) { return this.request<OverviewDTO>('GET', `/stores/${storeId}/analytics/overview`); }
  productStats(storeId: string, productId: string) { return this.request<{ product: ProductDTO; by_status: Record<string, number>; activations_by_day: { date: string; activations: number; failures: number }[]; live_sessions: number }>('GET', `/stores/${storeId}/analytics/products/${productId}`); }
  activations(storeId: string, query?: { page?: number; page_size?: number; type?: string }) { return this.request<Paginated<LicenseEventDTO>>('GET', `/stores/${storeId}/analytics/events`, undefined, query); }
  auditLogs(storeId: string, query?: { page?: number; page_size?: number; action?: string }) { return this.request<Paginated<AuditLogDTO>>('GET', `/stores/${storeId}/audit`, undefined, query); }
  securityEvents(storeId: string, query?: { page?: number; page_size?: number; severity?: string }) { return this.request<Paginated<SecurityEventDTO>>('GET', `/stores/${storeId}/security-events`, undefined, query); }
  acknowledgeSecurityEvent(storeId: string, eventId: string) { return this.request<{ ok: true }>('POST', `/stores/${storeId}/security-events/${eventId}/acknowledge`, {}); }

  /* ---------------- API keys ---------------- */
  apiKeys(storeId: string) { return this.request<{ items: ApiKeyDTO[] }>('GET', `/stores/${storeId}/api-keys`); }
  createApiKey(storeId: string, name: string, permissions: Permission[]) { return this.request<ApiKeyDTO & { key: string }>('POST', `/stores/${storeId}/api-keys`, { name, permissions }); }
  revokeApiKey(storeId: string, keyId: string) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}/api-keys/${keyId}`); }

  /* ---------------- Roblox & Robux sales (store side) ---------------- */
  robloxStatus() { return this.request<{ configured: boolean }>('GET', '/roblox/status'); }
  /** Returns a URL to navigate to (top-level) that starts Roblox OAuth. */
  robloxConnect(purpose: 'store' | 'link', opts: { storeId?: string; redirect?: string } = {}) { return this.request<{ url: string }>('POST', '/roblox/connect', { purpose, store_id: opts.storeId, redirect: opts.redirect }); }
  robloxMe() { return this.request<RobloxLinkDTO>('GET', '/roblox/me'); }
  robloxUnlink() { return this.request<{ ok: true }>('DELETE', '/roblox/me'); }
  storeRoblox(storeId: string) { return this.request<StoreRobloxDTO>('GET', `/stores/${storeId}/roblox`); }
  selectRobloxOwner(storeId: string, ownerType: 'User' | 'Group', ownerId: string) { return this.request<{ ok: true }>('POST', `/stores/${storeId}/roblox/select`, { owner_type: ownerType, owner_id: ownerId }); }
  disconnectStoreRoblox(storeId: string) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}/roblox`); }
  gamePasses(storeId: string, universeId: string) { return this.request<{ items: GamePassDTO[] }>('GET', `/stores/${storeId}/roblox/universes/${universeId}/game-passes`); }
  createGamePassSale(storeId: string, productId: string, universeId: string, priceRobux: number, name?: string) {
    return this.request<{ gamepass: GamePassDTO }>('POST', `/stores/${storeId}/roblox/products/${productId}/sale`, { mode: 'create', universe_id: universeId, price_robux: priceRobux, name });
  }
  linkGamePassSale(storeId: string, productId: string, universeId: string, gamePassId: string) {
    return this.request<{ gamepass: GamePassDTO }>('POST', `/stores/${storeId}/roblox/products/${productId}/sale`, { mode: 'link', universe_id: universeId, gamepass_id: gamePassId });
  }
  updateSale(storeId: string, productId: string, input: { for_sale?: boolean }) { return this.request<{ ok: true; for_sale: boolean; price_robux: number | null }>('PATCH', `/stores/${storeId}/roblox/products/${productId}/sale`, input); }
  removeSale(storeId: string, productId: string) { return this.request<{ ok: true }>('DELETE', `/stores/${storeId}/roblox/products/${productId}/sale`); }
  sales(storeId: string, days = 30) { return this.request<SalesDTO>('GET', `/stores/${storeId}/sales`, undefined, { days }); }

  /* ---------------- Storefront & purchases (buyer side) ---------------- */
  shop(slug: string) { return this.request<ShopStoreDTO>('GET', `/shop/stores/${slug}`); }
  shopProduct(slug: string, productId: string) { return this.request<{ store: { name: string; slug: string }; product: ShopProductDTO }>('GET', `/shop/stores/${slug}/products/${productId}`); }
  startPurchase(slug: string, productId: string) { return this.request<PurchaseDTO>('POST', `/shop/stores/${slug}/products/${productId}/purchase`, {}); }
  purchases() { return this.request<{ items: PurchaseDTO[] }>('GET', '/shop/purchases'); }
  purchase(id: string) { return this.request<PurchaseDTO>('GET', `/shop/purchases/${id}`); }
  checkPurchase(id: string) { return this.request<PurchaseDTO>('POST', `/shop/purchases/${id}/check`, {}); }
  purchaseDownload(id: string) { return this.request<{ url: string; file_name: string; expires_at: string }>('POST', `/shop/purchases/${id}/download`, {}); }

  /* ---------------- Customer portal ---------------- */
  redeem(token: string) { return this.request<RedeemResultDTO>('POST', '/redeem', { token }); }

  /* ---------------- Platform administration ---------------- */
  adminStats() { return this.request<{ stores: number; users: number; products: number; licenses: number; live_sessions: number; security_events_24h: number }>('GET', '/admin/stats'); }
  adminStores(query?: { q?: string; page?: number }) { return this.request<Paginated<{ id: string; name: string; status: string; owner_discord_id: string; discord_guild_id: string; product_count: number; license_count: number; created_at: string }>>('GET', '/admin/stores', undefined, query); }
  adminSetStoreStatus(storeId: string, status: 'active' | 'suspended', reason: string) { return this.request<{ ok: true }>('POST', `/admin/stores/${storeId}/status`, { status, reason, confirm: true }); }
  adminSecurityEvents(query?: { page?: number; severity?: string }) { return this.request<Paginated<SecurityEventDTO>>('GET', '/admin/security-events', undefined, query); }
}
