export interface CommandSnippet {
  id: string;
  title: string;
  command_template: string;
  description: string | null;
  tags: string[];
  is_builtin: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveSnippetPayload {
  id?: string;
  title: string;
  command_template: string;
  description?: string | null;
  tags: string[];
  is_enabled?: boolean;
}
