import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useVaultStore } from './vault.store';
import { inventoryService } from '../services/inventory.service';
import type { IdentitySummary } from '../types/inventory';

vi.mock('../services/inventory.service', () => ({
  inventoryService: {
    getInventory: vi.fn(),
    saveIdentity: vi.fn(),
    deleteIdentity: vi.fn(),
  },
}));

describe('vault store identity management', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should store and retrieve identities with public keys', async () => {
    const mockIdentities: IdentitySummary[] = [
      {
        id: 'ident-1',
        name: 'Personal Key',
        username: 'jonathan',
        auth_type: 'private_key',
        public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... personal',
        has_secret: true,
        has_passphrase: false,
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ident-2',
        name: 'Corporate Key',
        username: 'admin',
        auth_type: 'private_key',
        public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAA... corporate',
        has_secret: true,
        has_passphrase: true,
        updated_at: new Date().toISOString(),
      },
      {
        id: 'ident-3',
        name: 'Hardware Token',
        username: 'root',
        auth_type: 'agent',
        public_key: null,
        has_secret: false,
        has_passphrase: false,
        updated_at: new Date().toISOString(),
      },
    ];

    vi.mocked(inventoryService.getInventory).mockResolvedValueOnce({
      folders: [],
      identities: mockIdentities,
      hosts: [],
    });

    const store = useVaultStore();
    await store.fetchInventory();

    expect(store.identities.length).toBe(3);
    expect(store.identities[0].public_key).toBe('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... personal');
    expect(store.identities[1].public_key).toBe('ssh-rsa AAAAB3NzaC1yc2EAAAA... corporate');
    expect(store.identities[2].auth_type).toBe('agent');
  });

  it('should save identity and refresh inventory', async () => {
    vi.mocked(inventoryService.saveIdentity).mockResolvedValueOnce('new-ident-id');
    vi.mocked(inventoryService.getInventory).mockResolvedValueOnce({
      folders: [],
      identities: [
        {
          id: 'new-ident-id',
          name: 'New Ed25519',
          username: 'deploy',
          auth_type: 'private_key',
          public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... deploy',
          has_secret: true,
          has_passphrase: false,
          updated_at: new Date().toISOString(),
        },
      ],
      hosts: [],
    });

    const store = useVaultStore();
    const resultId = await store.saveIdentity({
      name: 'New Ed25519',
      username: 'deploy',
      auth_type: 'private_key',
      public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... deploy',
      secret: '-----BEGIN OPENSSH PRIVATE KEY-----...',
    });

    expect(resultId).toBe('new-ident-id');
    expect(inventoryService.saveIdentity).toHaveBeenCalledTimes(1);
    expect(store.identities.length).toBe(1);
    expect(store.identities[0].public_key).toContain('ssh-ed25519');
  });
});
