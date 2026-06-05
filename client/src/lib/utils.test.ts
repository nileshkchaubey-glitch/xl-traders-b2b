import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "end")).toBe("base end");
  });

  it("merges conflicting Tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles undefined and null inputs", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("handles empty string inputs", () => {
    expect(cn("a", "", "b")).toBe("a b");
  });

  it("returns empty string when called with no args", () => {
    expect(cn()).toBe("");
  });

  it("handles array inputs via clsx", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("deduplicates with tailwind-merge", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});
