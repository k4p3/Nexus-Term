import { describe, it, expect } from "vitest";

describe("Performance & Lazy Loading Architecture", () => {
  it("verifies dynamic imports for heavy secondary components", async () => {
    // Dynamic import paths must exist and resolve to valid Vue components
    const settingsPromise = import("../components/settings/SettingsModal.vue");
    const sftpPromise = import("../components/sftp/SftpSidebar.vue");
    const tunnelsPromise = import("../components/tunnels/PortForwardManager.vue");
    const snippetsPromise = import("../components/snippets/SnippetDrawer.vue");
    const remoteDesktopPromise = import("../components/remote/RemoteDesktopPane.vue");

    const [settings, sftp, tunnels, snippets, remoteDesktop] = await Promise.all([
      settingsPromise,
      sftpPromise,
      tunnelsPromise,
      snippetsPromise,
      remoteDesktopPromise,
    ]);

    expect(settings.default).toBeDefined();
    expect(sftp.default).toBeDefined();
    expect(tunnels.default).toBeDefined();
    expect(snippets.default).toBeDefined();
    expect(remoteDesktop.default).toBeDefined();
  });
});
