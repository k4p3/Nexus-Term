## ADDED Requirements

### Requirement: Zero-Knowledge Storage
The server SHALL store synchronized records only as opaque envelopes exactly as received and SHALL NOT receive, derive or store the master password, the Secret Key, the vault key, the Recovery Key or any key able to decrypt an envelope. For each account it SHALL store only a verifier of the authentication key, the public KDF parameters and the key bundle.

#### Scenario: Database dump has no plaintext
- **WHEN** records containing hostnames, usernames and snippet text are synchronized and the database file is inspected
- **THEN** none of that text appears in it in clear.

#### Scenario: Envelopes are not modified
- **WHEN** a client pushes an envelope and another client pulls it
- **THEN** the pulled envelope is identical to the pushed one.

### Requirement: Invitation-Only Accounts
Accounts SHALL be created only by presenting a valid single-use invitation issued by the administrator. Invitations SHALL expire, SHALL be stored only as a hash and SHALL be revocable.

#### Scenario: Register with a valid invitation
- **WHEN** a client registers with an unused, unexpired invitation, a free username, an authentication key, KDF parameters and a key bundle
- **THEN** the account and the first device are created and a device token is returned once
- **AND** the invitation can no longer be used.

#### Scenario: Invalid invitation
- **WHEN** the invitation is unknown, expired, revoked or already used
- **THEN** registration is rejected and no account is created.

#### Scenario: Username already taken
- **WHEN** the requested username exists
- **THEN** registration is rejected without consuming the invitation.

#### Scenario: Administrator credentials required
- **WHEN** an administrative endpoint is called without the correct administrator token
- **THEN** it is rejected
- **AND** the server refuses to start if no administrator token of at least 32 characters is configured.

### Requirement: Authentication And Devices
Clients SHALL authenticate with the authentication key derived on the client and, once authenticated, with a per-device token of 256 bits. The server SHALL store only a hash of each token, SHALL compare secrets in constant time and SHALL allow a device to be revoked immediately.

#### Scenario: Login on a new device
- **WHEN** a client obtains the KDF parameters, derives the authentication key and logs in with the correct username and key
- **THEN** a new device token and the key bundle are returned.

#### Scenario: Wrong credentials
- **WHEN** the username or the authentication key is wrong
- **THEN** the response is the same generic error in both cases.

#### Scenario: No user enumeration
- **WHEN** the KDF parameters of an existing and of a non-existing username are requested
- **THEN** both answers have the same shape and the parameters of an unknown user are stable across requests.

#### Scenario: Revoked device
- **WHEN** a device is revoked
- **THEN** its token is rejected on the next request
- **AND** the other devices of the account keep working.

#### Scenario: Token handling
- **WHEN** tokens are stored or logged
- **THEN** only their hash is stored and no token appears in any log.

### Requirement: Key Bundle Management
The server SHALL store one key bundle per account with a version number and SHALL accept an update only if the client presents the current version, optionally together with a new authentication key verifier.

#### Scenario: Update with current version
- **WHEN** a client uploads a new bundle declaring the current version
- **THEN** it is stored with the version incremented.

#### Scenario: Stale update
- **WHEN** the declared version is not the current one
- **THEN** the update is rejected with a conflict and the stored bundle is unchanged.

### Requirement: Record Synchronization
The server SHALL store, per account, the latest envelope of each record identified by `kind` and `id`, and SHALL accept a pushed envelope only if its `rev` is exactly the stored `rev` plus one (or 1 for a new record). Every accepted change SHALL receive a per-account monotonic `seq`.

#### Scenario: Accepted change
- **WHEN** a client pushes an envelope with the next revision
- **THEN** it is stored with a new `seq` and the response includes that `seq`.

#### Scenario: Conflict
- **WHEN** the pushed `rev` is not the next one
- **THEN** that change is rejected with a conflict that includes the current envelope
- **AND** the other changes of the same request are processed independently.

#### Scenario: Idempotent retry
- **WHEN** the same envelope is pushed again after a lost response
- **THEN** it is accepted without creating a new revision or `seq`.

#### Scenario: Pull changes
- **WHEN** a client requests changes since a `seq`
- **THEN** it receives, in `seq` order and in pages, the envelopes accepted after that `seq`
- **AND** the `seq` to continue from.

#### Scenario: Accounts are isolated
- **WHEN** one account requests or pushes records
- **THEN** it never sees nor affects the records of another account.

### Requirement: Tombstone Retention
Deleted records SHALL be kept as tombstone envelopes for a configurable number of days (90 by default) and purged afterwards. A client whose `since` is older than the purge point SHALL receive `410 Gone` and perform a full resynchronization.

#### Scenario: Purge
- **WHEN** a tombstone is older than the retention period
- **THEN** it is purged and the account's purge floor is advanced.

#### Scenario: Stale device
- **WHEN** a device requests changes since a `seq` older than the purge floor
- **THEN** the server answers `410 Gone`.

### Requirement: Abuse Protection And Limits
The server SHALL limit failed authentication attempts per client address and username, request body sizes, records per request, and per-account records and users, answering with the appropriate error and, for rate limits, a `Retry-After` header.

#### Scenario: Login rate limit
- **WHEN** more than 5 failed logins occur for the same address and username within 15 minutes
- **THEN** further attempts are answered with `429` and `Retry-After`, even with correct credentials, until the window passes.

#### Scenario: Size and quota limits
- **WHEN** a request body, an envelope, a batch or an account's record count exceeds its limit
- **THEN** it is rejected with `413` or `422` and nothing is stored.

#### Scenario: Proxy headers
- **WHEN** the server is not configured to trust a proxy
- **THEN** forwarded-address headers are ignored for rate limiting.

### Requirement: Privacy-Preserving Logs
The server SHALL NOT log request or response bodies, tokens, authentication keys or invitations, and SHALL log authentication failures without secrets.

#### Scenario: Logs
- **WHEN** requests are served, including failures
- **THEN** logs contain method, path, status and duration, and no secret material.

### Requirement: Docker Deployment
The server SHALL be distributed as a container image that runs as a non-root user, stores all data under a single volume, exposes a health check, can be operated with CLI subcommands for invitations and users, and is published for amd64 and arm64.

#### Scenario: Run with compose
- **WHEN** the example `docker-compose.yml` is started with an administrator token and the reverse proxy configured
- **THEN** the health check turns healthy
- **AND** data survives restarting or recreating the container.

#### Scenario: Create an invitation from the host
- **WHEN** the operator runs the invitation subcommand inside the container
- **THEN** a single-use invitation code is printed.

#### Scenario: Hardened by default
- **WHEN** the example deployment runs
- **THEN** the container has no shell, a read-only root file system, no extra capabilities and `no-new-privileges`.
