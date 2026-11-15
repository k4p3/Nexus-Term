export interface Folder {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  updated_at: string;
}

export type AuthType = "password" | "private_key" | "agent";

export interface IdentitySummary {
  id: string;
  name: string;
  username: string;
  auth_type: AuthType;
  public_key?: string | null;
  has_secret: boolean;
  has_passphrase: boolean;
  updated_at: string;
}

export interface SaveIdentityPayload {
  id?: string | null;
  name: string;
  username: string;
  auth_type: AuthType;
  public_key?: string | null;
  secret?: string | null;
  passphrase?: string | null;
}

export interface HostSummary {
  id: string;
  folder_id: string | null;
  label: string;
  hostname: string;
  port: number;
  username_override: string | null;
  identity_id: string | null;
  tags: string[];
  notes: string | null;
  updated_at: string;
}

export interface SaveHostPayload {
  id?: string | null;
  folder_id?: string | null;
  label: string;
  hostname: string;
  port: number;
  username_override?: string | null;
  identity_id?: string | null;
  tags: string[];
  notes?: string | null;
}

export interface InventoryData {
  folders: Folder[];
  identities: IdentitySummary[];
  hosts: HostSummary[];
}
