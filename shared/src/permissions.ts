/**
 * Store-level permissions. Every permission is enforced server-side by the API;
 * the frontend and Discord bot only use this list for presentation.
 */
export const PERMISSIONS = [
  'products.view',
  'products.upload',
  'products.edit',
  'products.delete',
  'licenses.view',
  'licenses.create',
  'licenses.revoke',
  'licenses.transfer',
  'customers.view',
  'customers.manage',
  'analytics.view',
  'admins.manage',
  'settings.manage',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string; category: string }> = {
  'products.view': { label: 'View products', description: 'See products, versions and integration documentation.', category: 'Products' },
  'products.upload': { label: 'Upload & publish', description: 'Create products, upload files and publish new versions.', category: 'Products' },
  'products.edit': { label: 'Edit products', description: 'Change product details and license policies.', category: 'Products' },
  'products.delete': { label: 'Delete products', description: 'Archive products and revoke access to them.', category: 'Products' },
  'licenses.view': { label: 'View licenses', description: 'See licenses (masked) and their history.', category: 'Licenses' },
  'licenses.create': { label: 'Generate keys', description: 'Issue new license keys and replace credentials.', category: 'Licenses' },
  'licenses.revoke': { label: 'Revoke keys', description: 'Revoke, suspend and reinstate licenses.', category: 'Licenses' },
  'licenses.transfer': { label: 'Transfer keys', description: 'Move a license to another Roblox account or reset its binding.', category: 'Licenses' },
  'customers.view': { label: 'View customers', description: 'See customer profiles, purchases and activation history.', category: 'Customers' },
  'customers.manage': { label: 'Manage customers', description: 'Suspend, restore and annotate customers.', category: 'Customers' },
  'analytics.view': { label: 'View analytics', description: 'See store analytics and security events.', category: 'Store' },
  'admins.manage': { label: 'Manage administrators', description: 'Configure permission groups and Discord role assignments.', category: 'Store' },
  'settings.manage': { label: 'Manage settings', description: 'Change store profile, policies, notifications and API keys.', category: 'Store' },
  'audit.view': { label: 'View audit logs', description: 'Read the immutable store audit log.', category: 'Store' },
};

/**
 * Permissions that only the store owner may grant to a permission group.
 * This prevents administrators from escalating themselves to owner-equivalent access.
 */
export const OWNER_ONLY_GRANTS: readonly Permission[] = ['admins.manage', 'settings.manage'];

/** Suggested starter groups. Owners can edit or delete these freely. */
export const SUGGESTED_GROUPS: { name: string; description: string; permissions: Permission[] }[] = [
  {
    name: 'Product Manager',
    description: 'Uploads products, edits details and publishes versions.',
    permissions: ['products.view', 'products.upload', 'products.edit', 'licenses.view', 'analytics.view'],
  },
  {
    name: 'License Manager',
    description: 'Generates, revokes and transfers licenses.',
    permissions: ['products.view', 'licenses.view', 'licenses.create', 'licenses.revoke', 'licenses.transfer', 'customers.view'],
  },
  {
    name: 'Support',
    description: 'Read-only access to customers and license history.',
    permissions: ['products.view', 'licenses.view', 'customers.view'],
  },
];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
