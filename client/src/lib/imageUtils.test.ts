import { describe, expect, it } from "vitest";
import { imageSources, isDisplayImageObject } from "./imageUtils";

const root =
  "https://fixture.supabase.co/storage/v1/object/public/product-images/products/test";
describe("actual image rendition sources", () => {
  it("uses actual widths for portrait images and preserves query strings", () => {
    const src = `${root}.xl-web-400w-800w-1x.webp?v=1`;
    expect(imageSources(src, 300)).toEqual({
      src,
      srcSet: `${src} 400w, ${root}.xl-web-400w-800w-2x.webp?v=1 800w`,
      sizes: "300px",
    });
  });
  it("does not invent a larger image when the original is small", () => {
    expect(
      imageSources(`${root}.xl-web-200w-200w-1x.webp`, 300).srcSet
    ).toBeUndefined();
  });
  it.each([
    `${root}.webp`,
    "https://example.org/image.jpg",
    "https://example.org/test.xl-web-800w-1600w-1x.webp",
    "",
    null,
  ])("keeps legacy/external/missing sources unchanged: %s", src => {
    expect(imageSources(src, 300)).toEqual({
      src: src ?? "",
      srcSet: undefined,
      sizes: undefined,
    });
  });
  it("retains real Drive thumbnail sizing", () => {
    expect(
      imageSources("https://drive.google.com/file/d/fixture/view", 300)
    ).toEqual({
      src: "https://drive.google.com/thumbnail?id=fixture&sz=w300",
      srcSet:
        "https://drive.google.com/thumbnail?id=fixture&sz=w300 1x, https://drive.google.com/thumbnail?id=fixture&sz=w600 2x",
      sizes: undefined,
    });
  });
  it("excludes only managed companion files from library choices", () => {
    expect(isDisplayImageObject("test.xl-original.png")).toBe(false);
    expect(isDisplayImageObject("test.xl-web-800w-1600w-2x.webp")).toBe(false);
    expect(isDisplayImageObject("test.xl-web-800w-1600w-1x.webp")).toBe(true);
    expect(isDisplayImageObject("SKU-2.webp")).toBe(true);
  });
});
