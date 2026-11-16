export interface HistoryEntry {
  id: string;
  host_id: string;
  command: string;
  use_count: number;
  last_exit_code: number | null;
  last_used_at: string;
}
