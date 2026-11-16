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
    saveHost: vi.fn(),
    deleteHost: vi.fn(),
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

  it('should support hosts chained via jump_host_id', async () => {
    vi.mocked(inventoryService.getInventory).mockResolvedValueOnce({
      folders: [],
      identities: [],
      hosts: [
        {
          id: 'host-bastion',
          folder_id: null,
          jump_host_id: null,
          label: 'Bastion Gateway',
          hostname: 'bastion.corp.net',
          port: 22,
          username_override: 'ec2-user',
          identity_id: null,
          tags: ['bastion'],
          notes: null,
          updated_at: new Date().toISOString(),
        },
        {
          id: 'host-db-internal',
          folder_id: null,
          jump_host_id: 'host-bastion',
          label: 'Internal DB',
          hostname: '10.0.1.5',
          port: 5432,
          username_override: 'postgres',
          identity_id: null,
          tags: ['db', 'private'],
          notes: null,
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const store = useVaultStore();
    await store.fetchInventory();

    expect(store.hosts.length).toBe(2);
    expect(store.hosts[0].jump_host_id).toBeNull();
    expect(store.hosts[1].jump_host_id).toBe('host-bastion');
  });

  it('should save a host with jump_host_id payload', async () => {
    vi.mocked(inventoryService.saveHost).mockResolvedValueOnce('host-internal-1');
    vi.mocked(inventoryService.getInventory).mockResolvedValueOnce({
      folders: [],
      identities: [],
      hosts: [
        {
          id: 'host-internal-1',
          folder_id: null,
          jump_host_id: 'host-bastion',
          label: 'Internal Microservice',
          hostname: '10.0.2.10',
          port: 22,
          username_override: null,
          identity_id: null,
          tags: [],
          notes: null,
          updated_at: new Date().toISOString(),
        },
      ],
    });

    const store = useVaultStore();
    const resultId = await store.saveHost({
      label: 'Internal Microservice',
      hostname: '10.0.2.10',
      port: 22,
      jump_host_id: 'host-bastion',
      tags: [],
    });

    expect(resultId).toBe('host-internal-1');
    expect(inventoryService.saveHost).toHaveBeenCalledWith({
      label: 'Internal Microservice',
      hostname: '10.0.2.10',
      port: 22,
      jump_host_id: 'host-bastion',
      tags: [],
    });
    expect(store.hosts[0].jump_host_id).toBe('host-bastion');
  });
});
