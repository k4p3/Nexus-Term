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

  it("should process multi-file upload with concurrency limit", async () => {
    const store = useSftpStore();
    store.currentSessionId = "sess-sftp";
    store.currentPath = "/remote/dir";

    let resolveUpload1: () => void = () => {};
    let resolveUpload2: () => void = () => {};

    const upload1Promise = new Promise<void>((r) => { resolveUpload1 = r; });
    const upload2Promise = new Promise<void>((r) => { resolveUpload2 = r; });

    vi.mocked(sftpService.upload)
      .mockImplementationOnce(() => upload1Promise)
      .mockImplementationOnce(() => upload2Promise)
      .mockResolvedValue();

    // Default concurrency is 2. Uploading 3 files should start 2, queue 1
    await store.uploadFiles(["/local/file1.txt", "/local/file2.txt", "/local/file3.txt"]);

    expect(store.transfers.length).toBe(3);
    expect(store.activeTransfersCount).toBe(2);
    expect(store.queuedTransfersCount).toBe(1);
    expect(sftpService.upload).toHaveBeenCalledTimes(2);

    // Resolving upload 1 should trigger upload 3
    resolveUpload1();
    await new Promise((r) => setTimeout(r, 10));

    expect(sftpService.upload).toHaveBeenCalledTimes(3);
    resolveUpload2();
  });

  it("should compute overall progress and activeTransfersMap correctly", () => {
    const store = useSftpStore();
    store.transfers = [
      {
        transfer_id: "t-1",
        direction: "upload",
        filename: "data.bin",
        bytes_transferred: 250,
        total_bytes: 1000,
        percentage: 25,
        status: "in_progress",
      },
      {
        transfer_id: "t-2",
        direction: "upload",
        filename: "notes.txt",
        bytes_transferred: 0,
        total_bytes: 1000,
        percentage: 0,
        status: "queued",
      },
    ];

    expect(store.overallProgress.active).toBe(true);
    expect(store.overallProgress.total).toBe(2);
    expect(store.overallProgress.completed).toBe(0);
    expect(store.overallProgress.percentage).toBe(13); // 250 / 2000 = 12.5% -> 13%

    const map = store.activeTransfersMap;
    expect(map.get("data.bin")?.status).toBe("in_progress");
    expect(map.get("notes.txt")?.status).toBe("queued");
  });

  it("should clear completed transfers and allow retrying errors", () => {
    const store = useSftpStore();
    store.currentSessionId = "sess-1";
    store.transfers = [
      {
        transfer_id: "t-1",
        direction: "upload",
        filename: "file1.txt",
        bytes_transferred: 100,
        total_bytes: 100,
        percentage: 100,
        status: "completed",
      },
      {
        transfer_id: "t-2",
        direction: "upload",
        filename: "file2.txt",
        bytes_transferred: 0,
        total_bytes: 100,
        percentage: 0,
        status: "error",
        error_message: "Network lost",
      },
    ];

    store.clearCompleted();
    expect(store.transfers.length).toBe(1);
    expect(store.transfers[0].transfer_id).toBe("t-2");

    store.retryTransfer("t-2");
    expect(store.transfers[0].status).toBe("in_progress");
  });
});
