export const config = {
  runtime: "edge",
};

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");

const IGNORED_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto",
  "x-forwarded-port", "x-vercel-id", "x-vercel-proxy"
]);

export default async function forwardRequest(request) {
  if (!BACKEND_URL) {
    return new Response("Service configuration error", { 
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }

  try {
    const url = new URL(request.url);
    const targetUrl = BACKEND_URL + url.pathname + url.search;

    const headers = new Headers();
    let clientIP = null;

    for (const [key, value] of request.headers) {
      const lowerKey = key.toLowerCase();

      if (IGNORED_HEADERS.has(lowerKey) || lowerKey.startsWith("x-vercel-")) {
        continue;
      }

      if (lowerKey === "x-real-ip" || lowerKey === "x-forwarded-for") {
        if (!clientIP) clientIP = value;
        continue;
      }

      headers.set(key, value);
    }

    if (clientIP) {
      headers.set("X-Forwarded-For", clientIP);
    }

    const needsBody = !["GET", "HEAD"].includes(request.method);

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: needsBody ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

    return response;

  } catch (err) {
    console.error("Forward error:", err);
    return new Response("Forwarding service unavailable", { 
      status: 502 
    });
  }
}
