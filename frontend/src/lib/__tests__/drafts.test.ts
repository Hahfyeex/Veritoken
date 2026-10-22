import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import {
  useDraftStore,
  getDraft,
  saveDraft,
  discardDraft,
  hasDraft,
  DRAFT_FORMAT_VERSION,
} from "../drafts";

beforeEach(() => {
  useDraftStore.setState({ drafts: {} });
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("drafts store", () => {
  it("has no draft for a flow that was never saved", () => {
    expect(getDraft("deploy:invoice")).toBeUndefined();
    expect(hasDraft("deploy:invoice")).toBe(false);
  });

  it("saveDraft() then getDraft() round-trips the values", () => {
    saveDraft("deploy:invoice", { name: "Acme", symbol: "ACM" });
    const draft = getDraft("deploy:invoice");
    expect(draft).toBeDefined();
    expect(draft?.values).toEqual({ name: "Acme", symbol: "ACM" });
    expect(draft?.version).toBe(DRAFT_FORMAT_VERSION);
    expect(hasDraft("deploy:invoice")).toBe(true);
  });

  it("keeps drafts for different flows independent", () => {
    saveDraft("deploy:invoice", { name: "Invoice Co" });
    saveDraft("deploy:carbon", { name: "Carbon Co" });
    expect(getDraft("deploy:invoice")?.values).toEqual({ name: "Invoice Co" });
    expect(getDraft("deploy:carbon")?.values).toEqual({ name: "Carbon Co" });
  });

  it("discardDraft() removes the entry", () => {
    saveDraft("deploy:invoice", { name: "Acme" });
    expect(hasDraft("deploy:invoice")).toBe(true);
    discardDraft("deploy:invoice");
    expect(hasDraft("deploy:invoice")).toBe(false);
  });

  it("expires a draft once its TTL has elapsed, and purges it from the store", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    saveDraft("deploy:invoice", { name: "Acme" }, 1000);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    expect(getDraft("deploy:invoice")).toBeUndefined();

    // Expired entry is purged as a side effect of reading it.
    expect(useDraftStore.getState().drafts["deploy:invoice"]).toBeUndefined();
  });

  it("keeps an unexpired draft available right up to its TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    saveDraft("deploy:invoice", { name: "Acme" }, 1000);

    vi.setSystemTime(new Date("2026-01-01T00:00:00.500Z"));
    expect(getDraft("deploy:invoice")).toBeDefined();
  });

  it("treats a corrupted/old-format entry as absent and purges it", () => {
    useDraftStore.setState({
      drafts: {
        // @ts-expect-error intentionally malformed for the test
        "deploy:invoice": { version: 0, flow: "deploy:invoice" },
      },
    });
    expect(getDraft("deploy:invoice")).toBeUndefined();
    expect(useDraftStore.getState().drafts["deploy:invoice"]).toBeUndefined();
  });

  it("persists drafts to localStorage under the expected key", () => {
    saveDraft("deploy:invoice", { name: "Acme" });
    const raw = localStorage.getItem("veritoken-drafts");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.drafts["deploy:invoice"].values).toEqual({ name: "Acme" });
  });
});

describe("drafts store – reload simulation", () => {
  // In-memory StateStorage so the test never touches real browser storage.
  let backing: Map<string, string>;
  const memoryStorage: StateStorage = {
    getItem: (name) => backing.get(name) ?? null,
    setItem: (name, value) => {
      backing.set(name, value);
    },
    removeItem: (name) => {
      backing.delete(name);
    },
  };

  /** Simulate a page reload: wipe in-memory state, then rehydrate from storage. */
  async function reload(): Promise<void> {
    const persisted = new Map(backing);
    useDraftStore.setState({ drafts: {} });
    // setState writes through to storage; restore what was there "before reload".
    backing = persisted;
    await useDraftStore.persist.rehydrate();
  }

  beforeEach(() => {
    backing = new Map();
    useDraftStore.persist.setOptions({ storage: createJSONStorage(() => memoryStorage) });
    useDraftStore.setState({ drafts: {} });
    backing.clear();
  });

  afterEach(() => {
    useDraftStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) });
  });

  it("restores a saved draft's field values after reinitialization", async () => {
    saveDraft("deploy:invoice", { name: "Acme", symbol: "ACM", decimals: 7 });
    await reload();

    expect(getDraft("deploy:invoice")?.values).toEqual({ name: "Acme", symbol: "ACM", decimals: 7 });
  });

  it("starts empty when nothing was stored", async () => {
    await reload();
    expect(useDraftStore.getState().drafts).toEqual({});
    expect(hasDraft("deploy:invoice")).toBe(false);
  });

  it("falls back to no draft when the stored entry is malformed", async () => {
    backing.set(
      "veritoken-drafts",
      JSON.stringify({
        state: { drafts: { "deploy:invoice": { version: 0, flow: "deploy:invoice" } } },
        version: 0,
      }),
    );
    await useDraftStore.persist.rehydrate();

    expect(getDraft("deploy:invoice")).toBeUndefined();
    expect(useDraftStore.getState().drafts["deploy:invoice"]).toBeUndefined();
  });

  it("keeps the empty default when stored data is not valid JSON", async () => {
    backing.set("veritoken-drafts", "{not json");
    await useDraftStore.persist.rehydrate();

    expect(useDraftStore.getState().drafts).toEqual({});
  });
});
