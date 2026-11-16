export interface AppSettings {
  locale: string;
  font_family: string;
  font_size: number;
  line_height: number;
  cursor_style: 'block' | 'bar' | 'underline';
  cursor_blink: boolean;
  theme_id: string;
  default_shell: string | null;
  close_to_tray: boolean;
  auto_lock_minutes: number;
  sftp_max_concurrent_transfers: number;
}
