import { afterEach, describe, expect, it } from "vitest";
import { installPluginStyle, PLUGIN_STYLE } from "./style";

afterEach(() => {
  document.head.querySelectorAll("style[data-dsh-slot-widget]").forEach((node) => node.remove());
});

describe("production client styles", () => {
  it("scopes every standalone selector under the plugin root", () => {
    expect(PLUGIN_STYLE).not.toMatch(/(?:^|})\s*(?:\*|:root|html|body|#root|button|input)(?=[\s,.:#>{])/m);
    const dispose = installPluginStyle(document);
    const sheet = (document.head.querySelector("style[data-dsh-slot-widget]") as HTMLStyleElement).sheet!;
    const selectorGroups = collectSelectors(sheet.cssRules);
    expect(selectorGroups.length).toBeGreaterThan(20);
    for (const group of selectorGroups) {
      for (const selector of group.split(",")) {
        expect(selector.trim(), group).toContain(".dsh-slot-widget-root");
      }
    }
    dispose();
  });

  it("returns a disposer that removes only the materialized style tag", () => {
    const dispose = installPluginStyle(document);
    const style = document.head.querySelector("style[data-dsh-slot-widget]");
    expect(style).toHaveTextContent(".dsh-slot-widget-root");

    dispose();

    expect(document.head.querySelector("style[data-dsh-slot-widget]")).toBeNull();
  });
});

function collectSelectors(rules: CSSRuleList): string[] {
  const selectors: string[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
    else if ("cssRules" in rule) selectors.push(...collectSelectors((rule as CSSMediaRule).cssRules));
  }
  return selectors;
}
