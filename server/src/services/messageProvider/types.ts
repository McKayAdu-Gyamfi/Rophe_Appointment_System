export interface SendMessageInput {
  channel: "WHATSAPP" | "SMS" | "EMAIL";
  to: string; // phone number or email address
  body: string;
  subject?: string;
}

export interface WebhookResult {
  providerMessageId: string;
  status: "SENT" | "DELIVERED" | "FAILED";
  error?: string;
}

export interface MessageProvider {
  /**
   * Send a message through this provider.
   */
  send(input: SendMessageInput): Promise<{ providerMessageId: string }>;

  /**
   * Validate that an incoming webhook genuinely originated from the provider.
   */
  verifyWebhook(req: unknown): boolean;

  /**
   * Extract delivery status from an incoming webhook body.
   */
  parseWebhook(body: unknown): WebhookResult;
}
