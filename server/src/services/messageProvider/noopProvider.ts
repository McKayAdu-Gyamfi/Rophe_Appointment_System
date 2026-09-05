import crypto from "crypto";
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

  verifyWebhook(_req: unknown): boolean {
    return true;
  }

  parseWebhook(_body: unknown): WebhookResult {
    return {
      providerMessageId: "noop-synthetic-webhook",
      status: "DELIVERED",
    };
  }
}
