import { beforeEach, describe, expect, it, vi } from "vitest";
const { from, upload, remove, getPublicUrl, list, prepare } = vi.hoisted(
  () => ({
    from: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    getPublicUrl: vi.fn(),
    list: vi.fn(),
    prepare: vi.fn(),
  })
);
vi.mock("./supabase", () => ({ supabase: { storage: { from } } }));
vi.mock("./imageUtils", async original => ({
  ...(await original<typeof import("./imageUtils")>()),
  prepareImageSet: prepare,
}));
import { mediaService, storageService } from "./productService";

const original = new File(["original bytes"], "photo.png", {
  type: "image/png",
});
const web = new File(["web"], "photo.webp", { type: "image/webp" });
const large = new File(["large"], "photo.webp", { type: "image/webp" });
beforeEach(() => {
  vi.resetAllMocks();
  let sequence = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `fresh-${++sequence}` });
  from.mockReturnValue({ upload, remove, getPublicUrl, list });
  prepare.mockResolvedValue({
    original,
    web: { file: web, newDimensions: { w: 400, h: 800 } },
    large: { file: large, newDimensions: { w: 800, h: 1600 } },
  });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  getPublicUrl.mockImplementation(path => ({
    data: {
      publicUrl:
        "https://fixture.supabase.co/storage/v1/object/public/product-images/" +
        path,
    },
  }));
});
describe("managed image uploads", () => {
  it.each(["product", "category", "sku", "global", "master"])(
    "keeps the selected original and both WebP companions for %s",
    async surface => {
      const result =
        surface === "product"
          ? await storageService.uploadProductImage(original, "id")
          : surface === "category"
            ? await storageService.uploadCategoryImage(original, "id")
            : surface === "sku"
              ? await storageService.uploadBySku(original, "A/B", 2)
              : surface === "master"
                ? await storageService.uploadMasterImage(original, "id")
                : await mediaService.uploadGlobalImage(original);
      expect(prepare).toHaveBeenCalledWith(original);
      expect(upload).toHaveBeenCalledTimes(3);
      expect(upload.mock.calls.map(call => call[1])).toEqual([
        original,
        large,
        web,
      ]);
      expect(upload.mock.calls[0][0]).toMatch(/fresh-1\.xl-original\.png$/);
      expect(result).toMatch(/\.xl-web-400w-800w-1x\.webp$/);
      expect(upload.mock.calls.every(call => call[2].upsert === false)).toBe(
        true
      );
      expect(from).toHaveBeenCalledWith(
        surface === "category" ? "category-images" : "product-images"
      );
      expect(remove).not.toHaveBeenCalled();
    }
  );
  it("never overwrites a predecessor on replacement", async () => {
    const first = await storageService.uploadBySku(original, "TEST");
    const second = await storageService.uploadBySku(original, "TEST");
    expect(first).not.toBe(second);
    expect(remove).not.toHaveBeenCalled();
  });
  it("cleans only fresh successful keys and publishes no URL after partial failure", async () => {
    const error = new Error("Upload denied");
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error });
    await expect(
      storageService.uploadCategoryImage(original, "id")
    ).rejects.toBe(error);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    expect(getPublicUrl).not.toHaveBeenCalled();
  });
  it("performs no storage write if rendition generation fails", async () => {
    prepare.mockRejectedValue(new Error("Decode failed"));
    await expect(
      storageService.uploadCategoryImage(original, "id")
    ).rejects.toThrow("Decode failed");
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
  it("offers only primary renditions and existing legacy images by SKU", async () => {
    list.mockResolvedValue({
      data: [
        { name: "test.xl-original.png" },
        { name: "test.xl-web-400w-800w-2x.webp" },
        { name: "test.xl-web-400w-800w-1x.webp" },
        { name: "TEST.webp" },
      ],
      error: null,
    });
    expect(
      (await storageService.listBySku("TEST")).map(image => image.name)
    ).toEqual(["TEST.webp", "test.xl-web-400w-800w-1x.webp"]);
  });
});
