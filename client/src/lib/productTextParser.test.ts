import { afterEach, describe, expect, it, vi } from "vitest";
import { parseProductText } from "./productTextParser";
afterEach(() => vi.unstubAllEnvs());
describe("local product text extraction", () => {
  it("extracts only source details without a provider request even with a configured fake key", () => {
    vi.stubEnv(
      "VITE_ANTHROPIC_API_KEY",
      "sk-ant-not-a-real-key-regression-sentinel"
    );
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network must not be used"));
    try {
      expect(
        parseProductText(
          "Example Box\nBox of 100 pcs\nPrice: 250\nBrand: Example\nCups",
          ["Cups"]
        )
      ).toMatchObject({
        name: "Example Box",
        price: 250,
        quantity_in_unit: 100,
        unit_of_measure: "box",
        category_name: "Cups",
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });
  it("does not invent a description, unit, price or category from a bare name", () => {
    expect(parseProductText("Example product", ["Cups"])).toEqual({
      name: "Example product",
    });
  });
  it("handles empty input without invented fields", () => {
    expect(parseProductText("  \n  ", [])).toEqual({});
  });
});
