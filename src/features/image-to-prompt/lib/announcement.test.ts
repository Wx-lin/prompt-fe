import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOUNCEMENT_END, ANNOUNCEMENT_STORAGE_KEY, dismissAnnouncement, getAnnouncementSnapshot, getServerAnnouncementSnapshot, isAnnouncementActive, subscribeAnnouncement } from "./announcement";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T12:00:00+08:00"));
  localStorage.clear();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("feature announcement availability", () => {
  it("ends at the specified China-time deadline", () => {
    expect(isAnnouncementActive(ANNOUNCEMENT_END - 1)).toBe(true);
    expect(isAnnouncementActive(ANNOUNCEMENT_END)).toBe(false);
    expect(isAnnouncementActive(ANNOUNCEMENT_END + 1)).toBe(false);
  });
  it("keeps SSR deterministic and unavailable", () => {
    expect(getServerAnnouncementSnapshot()).toBe("unavailable");
    vi.stubGlobal("window", undefined);
    expect(getAnnouncementSnapshot()).toBe("unavailable");
    expect(() => dismissAnnouncement()).not.toThrow();
    expect(() => subscribeAnnouncement(vi.fn())()).not.toThrow();
  });
  it("shows the announcement for a new visitor before the deadline", () => {
    expect(getAnnouncementSnapshot()).toBe("active");
    localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, "not-a-dismissal");
    expect(getAnnouncementSnapshot()).toBe("active");
  });
  it("honors the stored dismissal flag", () => {
    localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, "1");
    expect(getAnnouncementSnapshot()).toBe("dismissed");
  });
  it("turns off the whole campaign after the deadline", () => {
    vi.setSystemTime(ANNOUNCEMENT_END);
    expect(getAnnouncementSnapshot()).toBe("ended");
  });
  it("notifies a subscriber at the deadline and removes the timer on unsubscribe", () => {
    vi.setSystemTime(ANNOUNCEMENT_END - 100);
    const change = vi.fn();
    const unsubscribe = subscribeAnnouncement(change);
    vi.advanceTimersByTime(100);
    expect(change).toHaveBeenCalledOnce();
    expect(getAnnouncementSnapshot()).toBe("ended");
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores unrelated cross-tab storage events", () => {
    const change = vi.fn();
    const unsubscribe = subscribeAnnouncement(change);
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: "1" }));
    expect(change).not.toHaveBeenCalled();
    unsubscribe();
  });
  it("synchronizes cross-tab dismissal and remembers it in the current SPA", () => {
    const change = vi.fn();
    const unsubscribe = subscribeAnnouncement(change);
    window.dispatchEvent(new StorageEvent("storage", { key: ANNOUNCEMENT_STORAGE_KEY, newValue: "1" }));
    expect(change).toHaveBeenCalledOnce();
    expect(getAnnouncementSnapshot()).toBe("dismissed");
    unsubscribe();
  });
  it("still remembers dismissal if browser storage is blocked", async () => {
    // A fresh module represents a fresh SPA, independent of earlier dismissals.
    vi.resetModules();
    const announcement = await import("./announcement");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(announcement.getAnnouncementSnapshot()).toBe("active");
    const change = vi.fn();
    const unsubscribe = announcement.subscribeAnnouncement(change);
    announcement.dismissAnnouncement();
    expect(change).toHaveBeenCalledOnce();
    expect(announcement.getAnnouncementSnapshot()).toBe("dismissed");
    unsubscribe();
  });
});
