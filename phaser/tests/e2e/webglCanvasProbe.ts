import type { Locator, Page } from "@playwright/test";

export interface WebglCanvasProbe {
  kind: "webgl" | "none";
  nonBackgroundSamples: number;
  preserveDrawingBuffer: boolean;
  renderer: string | null;
  vendor: string | null;
}

export async function probeWebglCanvas(canvas: Locator): Promise<WebglCanvasProbe> {
  return canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const context =
      canvasElement.getContext("webgl2") ?? canvasElement.getContext("webgl");
    if (!context) {
      return {
        kind: "none",
        nonBackgroundSamples: 0,
        preserveDrawingBuffer: false,
        renderer: null,
        vendor: null,
      } as const;
    }

    const rendererInfo = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = rendererInfo
      ? String(context.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL))
      : null;
    const vendor = rendererInfo
      ? String(context.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL))
      : null;
    const preserveDrawingBuffer =
      context.getContextAttributes()?.preserveDrawingBuffer ?? false;
    if (!preserveDrawingBuffer) {
      return {
        kind: "webgl",
        nonBackgroundSamples: 0,
        preserveDrawingBuffer,
        renderer,
        vendor,
      } as const;
    }

    const pixels = new Uint8Array(canvasElement.width * canvasElement.height * 4);
    context.readPixels(
      0,
      0,
      canvasElement.width,
      canvasElement.height,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixels,
    );
    let nonBackgroundSamples = 0;
    for (let index = 0; index < pixels.length; index += 4 * 257) {
      if (
        pixels[index] !== 17 ||
        pixels[index + 1] !== 19 ||
        pixels[index + 2] !== 24
      ) {
        nonBackgroundSamples += 1;
      }
    }

    return {
      kind: "webgl",
      nonBackgroundSamples,
      preserveDrawingBuffer,
      renderer,
      vendor,
    } as const;
  });
}

export async function probeVisibleCanvasSamples(
  page: Page,
  canvas: Locator,
  attempts = 3,
): Promise<number> {
  let maximumSamples = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const screenshot = await canvas.screenshot();
    const dataUrl = `data:image/png;base64,${screenshot.toString("base64")}`;
    const samples = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();

      const probe = document.createElement("canvas");
      probe.width = image.naturalWidth;
      probe.height = image.naturalHeight;
      const context = probe.getContext("2d");
      if (!context) return 0;
      context.drawImage(image, 0, 0);

      const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
      let nonBackgroundSamples = 0;
      for (let index = 0; index < pixels.length; index += 4 * 257) {
        if (
          pixels[index] !== 17 ||
          pixels[index + 1] !== 19 ||
          pixels[index + 2] !== 24
        ) {
          nonBackgroundSamples += 1;
        }
      }
      return nonBackgroundSamples;
    }, dataUrl);
    maximumSamples = Math.max(maximumSamples, samples);
    if (attempt + 1 < attempts) await page.waitForTimeout(50);
  }
  return maximumSamples;
}
