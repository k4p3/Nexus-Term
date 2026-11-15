import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSftpStore } from "./sftp.store";
import { sftpService } from "../services/sftp.service";

vi.mock("../services/sftp.service", () => ({
  sftpService: {
    connect: vi.fn(),
    resolveHome: vi.fn(),
    listDir: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    download: vi.fn(),
    upload: vi.fn(),
    disconnect: vi.fn(),
  },
}));

describe("sftp store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("should initialize with default closed state", () => {
    const store = useSftpStore();
    expect(store.isOpen).toBe(false);
    expect(store.currentSessionId).toBeNull();
    expect(store.currentPath).toBe("/");
    expect(store.entries).toEqual([]);
    expect(store.activeTransfersCount).toBe(0);
  });

  it("should generate correct breadcrumbs for deeply nested paths", () => {
    const store = useSftpStore();
    store.currentPath = "/var/log/nginx";

    expect(store.pathBreadcrumbs).toEqual([
      { label: "/", path: "/" },
      { label: "var", path: "/var" },
      { label: "log", path: "/var/log" },
      { label: "nginx", path: "/var/log/nginx" },
    ]);
  });

  it("should generate root breadcrumb for '/'", () => {
    const store = useSftpStore();
    store.currentPath = "/";

    expect(store.pathBreadcrumbs).toEqual([{ label: "/", path: "/" }]);
  });

  it("should navigate to path and update entries", async () => {
    const store = useSftpStore();
    store.currentSessionId = "sess-123";

    const mockEntries = [
      {
        name: "config.json",
        path: "/etc/config.json",
        size: 1024,
        is_dir: false,
        is_symlink: false,
        permissions_octal: "0644",
        permissions_str: "-rw-r--r--",
      },
      {
        name: "ssl",
        path: "/etc/ssl",
        size: 4096,
        is_dir: true,
        is_symlink: false,
        permissions_octal: "0755",
        permissions_str: "drwxr-xr-x",
      },
    ];

    vi.mocked(sftpService.listDir).mockResolvedValueOnce(["/etc", mockEntries]);

    await store.navigateTo("/etc");

    expect(sftpService.listDir).toHaveBeenCalledWith("sess-123", "/etc");
    expect(store.currentPath).toBe("/etc");
    expect(store.entries).toEqual(mockEntries);
    expect(store.selectedPaths).toEqual([]);
  });

  it("should toggle, select all and clear selection", () => {
    const store = useSftpStore();
    store.entries = [
      {
        name: "file1.txt",
        path: "/file1.txt",
        size: 100,
        is_dir: false,
        is_symlink: false,
        permissions_octal: "0644",
        permissions_str: "-rw-r--r--",
      },
      {
        name: "file2.txt",
        path: "/file2.txt",
        size: 200,
        is_dir: false,
        is_symlink: false,
        permissions_octal: "0644",
        permissions_str: "-rw-r--r--",
      },
    ];

    store.toggleSelect("/file1.txt");
    expect(store.selectedPaths).toEqual(["/file1.txt"]);

    store.toggleSelect("/file1.txt");
    expect(store.selectedPaths).toEqual([]);

    store.selectAll();
    expect(store.selectedPaths).toEqual(["/file1.txt", "/file2.txt"]);

    store.clearSelection();
    expect(store.selectedPaths).toEqual([]);
  });

  it("should count active transfers properly", () => {
    const store = useSftpStore();
    store.transfers = [
      {
        transfer_id: "t-1",
        direction: "download",
        filename: "file1.iso",
        bytes_transferred: 50,
        total_bytes: 100,
        percentage: 50,
        status: "in_progress",
      },
      {
        transfer_id: "t-2",
        direction: "upload",
        filename: "file2.iso",
        bytes_transferred: 100,
        total_bytes: 100,
        percentage: 100,
        status: "completed",
      },
    ];

    expect(store.activeTransfersCount).toBe(1);
  });
});
