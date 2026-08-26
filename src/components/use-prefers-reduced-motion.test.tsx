import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usePrefersReducedMotion", () => {
  it("tracks live media-query changes and removes its listener on unmount", () => {
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    const addEventListener = vi.fn((_type: string, next: (event: MediaQueryListEvent) => void) => {
      listener = next;
    });
    const removeEventListener = vi.fn();
    const mediaQuery = {
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    act(() => {
      listener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);

    const registeredListener = addEventListener.mock.calls[0]?.[1];
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", registeredListener);
  });
});
