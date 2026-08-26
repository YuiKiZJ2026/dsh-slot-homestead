import {
  assertClaimTransition,
  assertClientBundle,
  assertDifferentWebPort,
  assertGracefulSigintExit,
  assertPersistedSnapshot,
  configHasPluginRow,
  parseDshWebUrl,
  pluginEntryFromBootManifest,
} from "../../scripts/dsh-real-smoke.mjs";
import { describe, expect, it } from "vitest";

const PLUGIN_ID = "dsh-desktop-slot-widget";

describe("real DSH smoke parsing and assertions", () => {
  it("parses only the announced loopback URL with a nonzero OS-assigned port", () => {
    expect(parseDshWebUrl([
      "booting...",
      "dsh web: http://127.0.0.1:43127",
      "ready",
    ].join("\n"))).toBe("http://127.0.0.1:43127/");

    expect(() => parseDshWebUrl("dsh web: http://0.0.0.0:43127")).toThrow(/loopback/i);
    expect(() => parseDshWebUrl("dsh web: http://127.0.0.1:0")).toThrow(/nonzero/i);
  });

  it("recognizes the exact plugin row in composed config and not a partial match", () => {
    const config = [
      "- id: another-plugin",
      "  name: another-plugin",
      `- id: ${PLUGIN_ID}`,
      `  name: ${PLUGIN_ID}`,
      "  config: {}",
    ].join("\n");

    expect(configHasPluginRow(config, PLUGIN_ID)).toBe(true);
    expect(configHasPluginRow(config.replace(`name: ${PLUGIN_ID}`, "name: impostor"), PLUGIN_ID))
      .toBe(false);
  });

  it("extracts our exact client row from the root boot manifest", () => {
    const html = `<!doctype html><script>globalThis["__DSH_BOOT__"] = ${JSON.stringify({
      rev: "graph-rev",
      entries: [
        {
          id: PLUGIN_ID,
          url: `/plugins/${PLUGIN_ID}/client.js?rev=client-rev`,
          rev: "client-rev",
        },
      ],
    })}</script>`;

    expect(pluginEntryFromBootManifest(html, PLUGIN_ID)).toEqual({
      id: PLUGIN_ID,
      url: `/plugins/${PLUGIN_ID}/client.js?rev=client-rev`,
      rev: "client-rev",
    });
    expect(() => pluginEntryFromBootManifest(html, "missing-plugin")).toThrow(/boot manifest/i);
  });

  it("asserts the lazy client identity and durable claim/restart transition", () => {
    expect(() => assertClientBundle(
      `window.__ModuleLoader__.load({id:${JSON.stringify(PLUGIN_ID)},factory(){}})`,
      PLUGIN_ID,
    )).not.toThrow();
    expect(() => assertClientBundle("export default {}", PLUGIN_ID)).toThrow(/lazy client/i);

    const initial = { revision: 0, wallet: 0, lastGrantedLocalDate: null };
    const claimed = {
      revision: 1,
      wallet: 3,
      lastGrantedLocalDate: "2026-08-27",
    };
    expect(() => assertClaimTransition(initial, claimed)).not.toThrow();
    expect(() => assertPersistedSnapshot(claimed, { ...claimed })).not.toThrow();
    expect(() => assertPersistedSnapshot(claimed, { ...claimed, wallet: 0 }))
      .toThrow(/persistence/i);
  });

  it("requires a different restart port and the official graceful SIGINT outcome", () => {
    expect(() => assertDifferentWebPort(
      "http://127.0.0.1:43127/",
      "http://127.0.0.1:43128/",
    )).not.toThrow();
    expect(() => assertDifferentWebPort(
      "http://127.0.0.1:43127/",
      "http://127.0.0.1:43127/",
    )).toThrow(/restart port/i);

    expect(() => assertGracefulSigintExit({ code: 130, signal: null }, "linux")).not.toThrow();
    expect(() => assertGracefulSigintExit({ code: null, signal: "SIGINT" }, "win32")).not.toThrow();
    expect(() => assertGracefulSigintExit({ code: 0, signal: null }, "linux"))
      .toThrow(/SIGINT/i);
    expect(() => assertGracefulSigintExit({ code: null, signal: "SIGINT" }, "linux"))
      .toThrow(/SIGINT/i);
  });
});
