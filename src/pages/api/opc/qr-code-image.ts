import type { APIRoute } from "astro";

export const prerender = false;

function safeFilename(value: string) {
  return value
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);

    const text = url.searchParams.get("text") || "";
    const sizeRaw = Number(url.searchParams.get("size") || 1024);
    const download = url.searchParams.get("download") === "1";
    const filenameRaw = url.searchParams.get("filename") || "orange-pro-clean-qr-code";

    const size = Math.min(Math.max(sizeRaw, 200), 2000);

    if (!text || text.length > 2000) {
      return new Response("Missing or invalid QR text.", { status: 400 });
    }

    const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
    qrUrl.searchParams.set("size", `${size}x${size}`);
    qrUrl.searchParams.set("margin", "24");
    qrUrl.searchParams.set("data", text);

    const qrResponse = await fetch(qrUrl.toString());

    if (!qrResponse.ok) {
      return new Response("QR code could not be generated.", { status: 502 });
    }

    const image = await qrResponse.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", "image/png");
    headers.set("Cache-Control", "public, max-age=86400");

    if (download) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeFilename(filenameRaw)}.png"`
      );
    }

    return new Response(image, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("qr-code-image error", error);
    return new Response("Internal QR error.", { status: 500 });
  }
};