import crypto from "crypto";
import { env } from "../../config/env";
import { MessageProvider, SendMessageInput, WebhookResult } from "./types";

export class NoopProvider implements MessageProvider {
  async send(input: SendMessageInput): Promise<{ providerMessageId: string }> {
    if (input.channel === "EMAIL" && (!input.to || !input.to.includes("@"))) {
      console.warn(`[NoopProvider] Attempted to send an email without a valid email address. Aborting.`);
      return { providerMessageId: "noop-failed-invalid-email" };
    }

    const providerMessageId = `noop-${crypto.randomBytes(8).toString("hex")}`;
    
    console.log(`[NoopProvider] --------------------------------------------------`);
    console.log(`[NoopProvider] Sending message via ${input.channel}`);
    console.log(`[NoopProvider] To: ${input.to}`);
    if (input.subject) {
      console.log(`[NoopProvider] Subject: ${input.subject}`);
    }
    console.log(`[NoopProvider] Body:`);
    console.log(input.body);
    console.log(`[NoopProvider] --------------------------------------------------`);
    console.log(`[NoopProvider] Generated ID: ${providerMessageId}`);

    return { providerMessageId };
  }

  /**
   * There is no provider signing these, so the shared secret stands in for one:
   * set MESSAGE_WEBHOOK_SECRET and the header must match. Left unset (local
   * work) everything is accepted — but the check is the same shape a real
   * adapter implements, so wiring one up is replacing this method, not the
   * route around it.
   */
  verifyWebhook(req: unknown): boolean {
    if (!env.messageWebhookSecret) return true;

    const headers = (req as { headers?: Record<string, unknown> })?.headers ?? {};
    const provided = headers["x-webhook-secret"];
    return typeof provided === "string" && provided === env.messageWebhookSecret;
  }

  /**
   * Echoes the callback body. A real adapter parses its provider's payload
   * shape here; this one accepts the fields it would produce, which is what
   * makes the delivery path testable end to end without a provider contract.
   */
  parseWebhook(body: unknown): WebhookResult {
    const payload = (body ?? {}) as Partial<WebhookResult>;
    return {
      providerMessageId: payload.providerMessageId ?? "",
      status: payload.status ?? "DELIVERED",
      error: payload.error,
    };
  }
}
