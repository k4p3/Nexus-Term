export interface ParsedHostEntry {
  alias: string;
  hostname: string;
  port: number;
  user: string | null;
  identity_file: string | null;
  proxy_jump: string | null;
  is_duplicate: boolean;
}

export interface SshConfigPreview {
  config_path: string;
  known_hosts_path: string;
  config_found: boolean;
  known_hosts_found: boolean;
  hosts: ParsedHostEntry[];
  known_hosts_count: number;
}

export interface ImportSshConfigPayload {
  selected_hosts: ParsedHostEntry[];
  folder_name?: string | null;
  import_known_hosts: boolean;
  overwrite_duplicates: boolean;
}

export interface ImportSummary {
  hosts_imported: number;
  hosts_skipped: number;
  identities_created: number;
  known_hosts_imported: number;
  folder_id?: string | null;
}
