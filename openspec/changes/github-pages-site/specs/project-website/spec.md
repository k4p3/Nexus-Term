# Delta Spec: Sitio Web del Proyecto

## ADDED Requirements

### Requirement: Static Bilingual Website
The project SHALL provide a static website under `site/` in Spanish and English, with a home page, a usage guide and a keyboard shortcuts page in each language, and a root page that redirects to the visitor's language.

#### Scenario: Language parity
- **WHEN** a page exists in one language
- **THEN** an equivalent page MUST exist in the other language
- **AND** each page links to its counterpart through `hreflang` alternates and a language switch.

#### Scenario: Language redirect
- **WHEN** a visitor opens the site root
- **THEN** they are redirected to `es/` if their browser language is Spanish and to `en/` otherwise
- **AND** visitors without JavaScript see links to both languages.

#### Scenario: Unknown address
- **WHEN** a visitor opens a non-existent address
- **THEN** a `404.html` page offers links to both languages.

---

### Requirement: Promotional and Usage Content
The website SHALL present NexusTerm's main capabilities, its security model, the supported installation channels and a step-by-step usage guide, without claiming features the application does not provide.

#### Scenario: Landing page
- **WHEN** a visitor opens the home page
- **THEN** they see what NexusTerm is, its key features, a security summary, installation instructions, the GPLv3 licence and links to the repository and releases.

#### Scenario: Usage guide
- **WHEN** a visitor opens the guide
- **THEN** it explains, in order, how to create the vault, add a host, connect, split panes, use SFTP, tunnels and snippets, and the command blocks, history, Instant Replay and session restore features.

#### Scenario: Installation channels
- **WHEN** the installation section is rendered
- **THEN** it lists only distribution channels confirmed as published by the maintainer.

---

### Requirement: Shortcut Documentation Consistency
The shortcuts page of each language SHALL list every shortcut registered in `src/utils/shortcuts.ts`.

#### Scenario: New shortcut registered
- **WHEN** a shortcut is added to the registry and not to the site
- **THEN** the automated site test fails.

---

### Requirement: Privacy and Independence
The website MUST NOT load scripts, stylesheets, fonts, images or trackers from third-party domains, and MUST work without JavaScript except for optional conveniences.

#### Scenario: Self-contained assets
- **WHEN** the pages are analysed
- **THEN** every `src`, `href` and CSS `url()` that loads a resource points to a file inside `site/` or to a same-site relative path
- **AND** external domains appear only as plain navigation links (for example the repository).

#### Scenario: JavaScript disabled
- **WHEN** JavaScript is disabled
- **THEN** all content remains readable and navigable.

---

### Requirement: Backed Privacy Claim
The website SHALL state that NexusTerm collects no usage data and contacts no service other than the servers the user connects to, and an automated test MUST verify that the application's sources, dependencies and permissions remain consistent with that claim.

#### Scenario: Claim published
- **WHEN** the home page is rendered in either language
- **THEN** it contains the no-telemetry statement.

#### Scenario: Network capability introduced
- **WHEN** the application adds an HTTP client, an analytics or crash-reporting library, a new Tauri plugin or permission, or an external URL
- **THEN** the privacy audit test fails until the exception is reviewed and the claim is updated.

---

### Requirement: Valid and Accessible Pages
Every page SHALL declare its language, a unique title and a description, use semantic landmarks, respect `prefers-color-scheme` and be usable at 375 px width without horizontal scrolling.

#### Scenario: Broken internal links
- **WHEN** a page references a local file that does not exist
- **THEN** the automated site test fails.

#### Scenario: Illustrations
- **WHEN** an illustration is a mock-up
- **THEN** it has a text alternative and is labelled as an illustration, not as a real screenshot.

---

### Requirement: Automated Publication
The repository SHALL publish `site/` to GitHub Pages through a GitHub Actions workflow triggered by changes on `main` or manually.

#### Scenario: Reused assets
- **WHEN** the workflow prepares the site
- **THEN** the existing project icons and social preview are copied into `site/assets/img/` instead of being duplicated in version control.

#### Scenario: Minimal permissions
- **WHEN** the workflow runs
- **THEN** it requests only `contents: read`, `pages: write` and `id-token: write`.
