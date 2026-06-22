type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class SSEBroker {
  // Map of channelId -> Set of client connections
  private channels = new Map<string, Set<SSEClient>>();

  /**
   * Register a new client to a specific channel.
   * Returns a function to clean up / unregister the client.
   */
  register(channelId: string, controller: ReadableStreamDefaultController): string {
    const clientId = Math.random().toString(36).substring(2, 9);
    const client: SSEClient = { id: clientId, controller };

    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    
    this.channels.get(channelId)!.add(client);
    console.log(`[SSE] Client ${clientId} registered to channel: ${channelId}. Total channel clients: ${this.channels.get(channelId)!.size}`);

    // Send initial keep-alive comment
    this.sendComment(client, "connection established");

    return clientId;
  }

  /**
   * Unregister a client from a channel.
   */
  unregister(channelId: string, clientId: string) {
    const clients = this.channels.get(channelId);
    if (clients) {
      for (const client of clients) {
        if (client.id === clientId) {
          clients.delete(client);
          console.log(`[SSE] Client ${clientId} disconnected from channel: ${channelId}`);
          break;
        }
      }
      if (clients.size === 0) {
        this.channels.delete(channelId);
      }
    }
  }

  /**
   * Broadcast an event to all clients subscribed to a specific channel.
   */
  broadcast(channelId: string, eventName: string, data: any) {
    const clients = this.channels.get(channelId);
    if (!clients || clients.size === 0) return;

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encodedPayload = encoder.encode(payload);

    console.log(`[SSE] Broadcasting event "${eventName}" to ${clients.size} clients on channel: ${channelId}`);

    for (const client of clients) {
      try {
        client.controller.enqueue(encodedPayload);
      } catch (err) {
        // Client might have disconnected, we clean up
        console.error(`[SSE] Failed to send to client ${client.id}. Client disconnected.`);
        this.unregister(channelId, client.id);
      }
    }
  }

  /**
   * Send a keep-alive ping (comment line starting with :) to prevent connection timeouts.
   */
  pingAll() {
    const encoder = new TextEncoder();
    const pingPayload = encoder.encode(":\n\n"); // SSE comments start with a colon

    for (const [channelId, clients] of this.channels.entries()) {
      for (const client of clients) {
        try {
          client.controller.enqueue(pingPayload);
        } catch (err) {
          this.unregister(channelId, client.id);
        }
      }
    }
  }

  private sendComment(client: SSEClient, comment: string) {
    try {
      const encoder = new TextEncoder();
      client.controller.enqueue(encoder.encode(`: ${comment}\n\n`));
    } catch (err) {
      // Ignore
    }
  }
}

declare global {
  var sseBrokerGlobal: undefined | SSEBroker;
}

const sseBroker = globalThis.sseBrokerGlobal ?? new SSEBroker();

export default sseBroker;

if (process.env.NODE_ENV !== "production") {
  globalThis.sseBrokerGlobal = sseBroker;
}

// Start keep-alive ping interval (every 15 seconds) to keep connections active
if (!globalThis.sseBrokerGlobal) {
  setInterval(() => {
    sseBroker.pingAll();
  }, 15000);
}
