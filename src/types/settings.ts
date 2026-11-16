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
  remote_desktop_clipboard: boolean;
  paste_warning: boolean;
  paste_history_size: number;
  notify_long_commands: boolean;
  notify_threshold_seconds: number;
  notify_include_command: boolean;
}
