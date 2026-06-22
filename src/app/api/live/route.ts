import { NextRequest } from "next/server";
import sseBroker from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel");

  if (!channel) {
    return new Response("Missing channel parameter", { status: 400 });
  }

  let clientId: string | null = null;

  const stream = new ReadableStream({
    start(controller) {
      clientId = sseBroker.register(channel, controller);
    },
    cancel() {
      if (clientId) {
        sseBroker.unregister(channel, clientId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Encoding": "none",
    },
  });
}
