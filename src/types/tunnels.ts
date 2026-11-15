export type TunnelType = 'local' | 'remote' | 'dynamic';

export interface TunnelConfig {
  id: string;
  host_id: string;
  name: string;
  tunnel_type: TunnelType;
  local_host: string;
  local_port: number;
  remote_host?: string | null;
  remote_port?: number | null;
  auto_start: boolean;
  created_at: string;
  updated_at: string;
}

export interface TunnelConfigPayload {
  id?: string | null;
  host_id: string;
  name: string;
  tunnel_type: TunnelType;
  local_host?: string;
  local_port: number;
  remote_host?: string | null;
  remote_port?: number | null;
  auto_start?: boolean;
}

export interface TunnelRuntimeStatus {
  tunnel_id: string;
  status: 'active' | 'stopped' | 'error';
  error_message?: string | null;
  bytes_sent: number;
  bytes_received: number;
  active_connections: number;
}
