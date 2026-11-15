export interface CommandSnippet {
  id: string;
  title: string;
  command_template: string;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SaveSnippetPayload {
  id?: string;
  title: string;
  command_template: string;
  description?: string | null;
  tags: string[];
}
