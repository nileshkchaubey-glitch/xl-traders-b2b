import { beforeEach, describe, expect, it, vi } from "vitest";
import { orderingSettings } from "./orderingModel";
import type { Product } from "./supabase";

const { create, update, category } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  category: vi.fn(),
}));
vi.mock("./productService", () => ({
  productService: { create, update },
  categoryService: { getOrCreateUncategorized: category },
}));
import {
  EMPTY_PRODUCT_FORM,
  productToForm,
  saveProductForm,
} from "./productForm";

const form = {
  ...EMPTY_PRODUCT_FORM,
  name: "Test box",
  category_id: "category",
  price: "150",
  quantity_in_unit: "100",
  moq: "2",
  order_unit: "pcs" as const,
  order_step: "300",
};
beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: "new" });
  update.mockResolvedValue({ id: "existing" });
});

describe("shared ordering form", () => {
  it("loads ordering columns for both editors without dropping the current configuration", () => {
    const loaded = productToForm({
      ...form,
      quantity_in_unit: 100,
      moq: 2,
      order_step: 300,
      price: 150,
    } as unknown as Product);
    expect(loaded).toMatchObject({
      quantity_in_unit: "100",
      moq: "2",
      order_unit: "pcs",
      order_step: "300",
      price: "150",
    });
    expect(orderingSettings(loaded).spec.minPacks).toBe(3);
  });
  it("saves selling-unit price and existing pack-size column alongside customer ordering", async () => {
    await saveProductForm(form, { productId: "existing" });
    expect(update).toHaveBeenCalledWith(
      "existing",
      expect.objectContaining({
        price: 150,
        quantity_in_unit: 100,
        moq: 2,
        order_unit: "pcs",
        order_step: 300,
      })
    );
    expect(update.mock.calls[0][1]).not.toHaveProperty("pack_size");
  });
  it("permits unknown pack size in pack mode and persists cleared overrides as null", async () => {
    await saveProductForm({
      ...EMPTY_PRODUCT_FORM,
      name: "Test pack",
      category_id: "category",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        order_unit: "pack",
        quantity_in_unit: null,
        moq: null,
        order_step: null,
      })
    );
  });
  it.each([
    ["quantity_in_unit", "", "pack size"],
    ["quantity_in_unit", "1", "pack size"],
    ["quantity_in_unit", "2.5", "whole"],
    ["moq", "2.5", "MOQ"],
    ["order_step", "150", "multiple"],
    ["order_step", "0", "positive"],
    ["order_step", "abc", "positive"],
    ["order_step", "300.5", "whole"],
  ])(
    "rejects invalid %s=%s before any category lookup or write",
    async (key, value, message) => {
      await expect(
        saveProductForm({ ...form, category_id: "", [key]: value })
      ).rejects.toThrow(message);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(category).not.toHaveBeenCalled();
    }
  );
});
