## ADDED Requirements

### Requirement: Snippet Import
The application SHALL let the user import snippets from a JSON file in the `nexusterm-snippets` version 1 format, validating it and showing a summary of what will be imported, skipped and rejected before any snippet is saved.

#### Scenario: Valid file
- **WHEN** the user selects a file with `"format": "nexusterm-snippets"`, `"version": 1` and a list of snippets with `title` and `command`
- **THEN** a summary shows how many snippets will be imported
- **AND** after the user confirms they are created as custom, enabled snippets.

#### Scenario: Duplicates are skipped
- **WHEN** an imported snippet has the same title and command as an existing one, or appears twice in the file
- **THEN** it is skipped and counted in the summary
- **AND** no existing snippet is modified.

#### Scenario: Invalid entries
- **WHEN** an entry lacks `title` or `command`, has the wrong type, or exceeds the size limits
- **THEN** that entry is reported with its reason and not imported
- **AND** the valid entries can still be imported.

#### Scenario: Unsafe characters
- **WHEN** an entry's title, command or description contains a line break, a control character (including `ESC`), a bidirectional-control character or a zero-width/invisible character
- **THEN** that entry is reported as invalid with its reason and is not imported.

#### Scenario: Review before confirming
- **WHEN** the summary is shown
- **THEN** every command to import is listed in full
- **AND** commands matching risky patterns (privilege escalation, recursive deletion, piping a download into a shell) are flagged with a warning.

#### Scenario: Imported snippets are marked
- **WHEN** snippets are imported
- **THEN** they carry the reserved tag `imported`
- **AND** the snippet drawer shows an "imported" badge on them.

#### Scenario: Rejected file
- **WHEN** the file is not valid JSON, is larger than 1 MB, has another `format`, has an unknown `version`, or contains more than 500 snippets
- **THEN** nothing is imported and the reason is shown.

#### Scenario: Nothing is executed
- **WHEN** a snippet is imported
- **THEN** its command is stored as text only and is never run, inserted into a terminal or interpreted.

### Requirement: Snippet Export
The application SHALL let the user export their custom snippets to a JSON file in the `nexusterm-snippets` version 1 format. Built-in snippets SHALL NOT be exported.

#### Scenario: Export and re-import
- **WHEN** the user exports their custom snippets and imports the file in another installation
- **THEN** the same snippets are created there
- **AND** importing it again skips all of them as duplicates.

#### Scenario: Nothing to export
- **WHEN** the user has no custom snippets
- **THEN** the export action is disabled.
