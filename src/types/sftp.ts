export type TransferDirection = 'upload' | 'download';
export type TransferStatus = 'in_progress' | 'completed' | 'error' | 'cancelled';

export interface SftpEntry {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  is_symlink: boolean;
  permissions_octal: string;
  permissions_str: string;
  modified_at?: string | null;
}

export interface TransferProgress {
  transfer_id: string;
  direction: TransferDirection;
  filename: string;
  bytes_transferred: number;
  total_bytes: number;
  percentage: number;
  status: TransferStatus;
  error_message?: string | null;
}
