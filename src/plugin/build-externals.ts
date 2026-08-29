const hostPeerPackages = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-client-runtime",
  "@deepseek-ai/dsh-client-ui-layout",
  "@deepseek-ai/dsh-host-webserver",
  "@deepseek-ai/dsh-session",
  "@deepseek-ai/dsh-storage-domain",
];
const clientExternalIds = new Set(["react", "react/jsx-runtime"]);

export function isHostExternal(id: string): boolean {
  return id.startsWith("node:") || id === "electron" ||
    hostPeerPackages.some((peer) => id === peer || id.startsWith(`${peer}/`));
}

export function isClientExternal(id: string): boolean {
  return clientExternalIds.has(id);
}
