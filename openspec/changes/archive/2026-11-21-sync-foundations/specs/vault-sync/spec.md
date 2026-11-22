## ADDED Requirements

### Requirement: Encrypted Record Envelope
Every synchronized record SHALL be represented as a versioned envelope whose payload is the complete record serialized and encrypted with AES-256-GCM using the vault key. The envelope SHALL expose only `id`, `kind`, `rev`, `updated_at`, `deleted`, the algorithm identifier and version, the nonce and the ciphertext. The additional authenticated data SHALL bind the ciphertext to its `kind`, `id` and `rev`.

#### Scenario: Round trip
- **WHEN** a record is sealed into an envelope and opened with the same vault key
- **THEN** the original record is recovered unchanged.

#### Scenario: No plaintext leaks
- **WHEN** an envelope is serialized
- **THEN** no field of the record, such as a hostname, username, snippet text or secret, appears in it in clear.

#### Scenario: Tampering is detected
- **WHEN** the ciphertext, nonce, `kind`, `id` or `rev` of an envelope is modified, or it is opened with another key
- **THEN** opening it fails.

#### Scenario: Unknown version or algorithm
- **WHEN** an envelope declares an unsupported version or algorithm
- **THEN** opening it fails with an explicit error and does not guess.

### Requirement: Sync Key Hierarchy
The system SHALL derive the keys used for synchronization from the master password and a Secret Key, so that a server holding only the key bundle and the authentication verifier cannot decrypt the vault nor guess the master password offline without the Secret Key.

#### Scenario: Secret Key format
- **WHEN** a Secret Key is generated
- **THEN** it contains 128 bits of randomness, is rendered in grouped base32 with a version prefix and a checksum
- **AND** a mistyped Secret Key is rejected by the checksum before any derivation.

#### Scenario: Deterministic derivation
- **WHEN** the same master password, Secret Key and KDF parameters are used on two devices
- **THEN** both derive the same authentication key and wrapping key.

#### Scenario: Keys are independent
- **WHEN** the authentication key and the wrapping key are derived
- **THEN** they differ, and knowing the authentication key does not reveal the wrapping key.

#### Scenario: Either secret is required
- **WHEN** the master password or the Secret Key is wrong
- **THEN** the key bundle cannot be unwrapped.

### Requirement: Key Bundle
The vault key SHALL be exportable as a key bundle containing a list of independent wrappings of the vault key (`password+secret` and, optionally, `recovery`) and the KDF parameters (algorithm, memory, iterations, parallelism, salt), so that the parameters can be strengthened later without breaking existing accounts.

#### Scenario: Unwrap on another device
- **WHEN** a second device receives the key bundle and has the master password and the Secret Key
- **THEN** it recovers the same vault key and can open the envelopes created by the first device.

#### Scenario: Password change
- **WHEN** the master password changes
- **THEN** only the key bundle is re-wrapped
- **AND** existing envelopes remain valid without re-encryption.

#### Scenario: Sensitive material is wiped
- **WHEN** derived keys are no longer needed
- **THEN** they are zeroized from memory.

### Requirement: Local Change Tracking
The vault SHALL record, for folders, identities, hosts, SSH tunnels and custom snippets, which records changed since the last synchronization and which were deleted, without requiring the code that modifies them to be aware of synchronization. Changes applied from a server SHALL NOT be marked as pending.

#### Scenario: Insert and update mark pending
- **WHEN** a tracked record is created or modified locally
- **THEN** it is marked as pending and its `sync_rev` is preserved until the next push.

#### Scenario: Deletion leaves a tombstone
- **WHEN** a tracked record is deleted, including by a cascade from its parent
- **THEN** a tombstone with its `kind`, `id` and deletion time is stored.

#### Scenario: Built-in snippets are not tracked
- **WHEN** a built-in snippet is seeded, refreshed or disabled
- **THEN** it is never marked as pending nor generates a tombstone.

#### Scenario: Remote changes are not echoed
- **WHEN** a change is applied while `applying` is set
- **THEN** it is not marked as pending and no tombstone is created.

#### Scenario: Idempotent migration
- **WHEN** the migration runs on a vault that already has the tracking structures or on a legacy vault
- **THEN** it completes without data loss
- **AND** existing records are initially marked as pending so they are uploaded on first synchronization.

### Requirement: Recovery Key
The system SHALL support an optional Recovery Key, generated with 256 bits of randomness and rendered with a version prefix and a checksum, that wraps its own copy of the vault key in the key bundle independently of the master password and the Secret Key. Using it SHALL allow setting a new master password without losing data.

#### Scenario: Recover after losing the master password
- **WHEN** the user has lost the master password but has the Recovery Key
- **THEN** the vault key is recovered from the `recovery` wrapping
- **AND** a new master password can be set, re-wrapping the `password+secret` entry, without re-encrypting any record.

#### Scenario: Recovery Key is independent
- **WHEN** the Recovery Key is generated or rotated
- **THEN** the master password and the Secret Key are not needed to use it
- **AND** it cannot derive the authentication key nor the other wrapping.

#### Scenario: Mistyped key
- **WHEN** a Recovery Key with a wrong checksum is entered
- **THEN** it is rejected before any derivation.

#### Scenario: Optional and revocable
- **WHEN** no Recovery Key was generated, or it is revoked
- **THEN** the bundle contains no `recovery` wrapping and the key cannot unlock it.

### Requirement: Emergency Kit
The system SHALL be able to produce the text of an emergency kit containing the server URL, the account name, the Secret Key and, when generated, the Recovery Key, together with custody instructions. The kit SHALL NEVER contain the master password nor the vault key.

#### Scenario: Kit content
- **WHEN** an emergency kit is generated for an account
- **THEN** it includes the server URL, the account name, the Secret Key and the custody warnings
- **AND** includes the Recovery Key only if one exists.

#### Scenario: Never the master password
- **WHEN** an emergency kit is generated
- **THEN** it contains neither the master password nor the vault key in any form.
