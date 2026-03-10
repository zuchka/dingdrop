import { z } from "zod";

/**
 * Zod schemas for runtime validation of notification channel configs
 * These ensure that decrypted configs have the expected shape before use
 */

export const emailConfigSchema = z.object({
  to: z.string().email("Invalid email address"),
  from: z.string().email("Invalid from email address").optional(),
});

export const slackWebhookConfigSchema = z.object({
  webhookUrl: z
    .string()
    .url("Invalid webhook URL")
    .startsWith("https://hooks.slack.com", "Must be a Slack webhook URL"),
});

export const discordWebhookConfigSchema = z.object({
  webhookUrl: z
    .string()
    .url("Invalid webhook URL")
    .startsWith("https://discord.com/api/webhooks/", "Must be a Discord webhook URL"),
});

export const pagerdutyConfigSchema = z.object({
  integrationKey: z.string().min(1, "Integration key is required"),
  severity: z.enum(["critical", "error", "warning", "info"]).optional(),
});

export const twilioSmsConfigSchema = z.object({
  accountSid: z.string().min(1, "Account SID is required"),
  authToken: z.string().min(1, "Auth token is required"),
  from: z.string().min(1, "From phone number is required"),
  to: z.string().min(1, "To phone number is required"),
});

export const genericWebhookConfigSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  headers: z.record(z.string()).optional(),
  authType: z.enum(["none", "bearer", "basic"]).default("none"),
  authToken: z.string().optional(),
});

// Type exports for TypeScript
export type EmailConfig = z.infer<typeof emailConfigSchema>;
export type SlackWebhookConfig = z.infer<typeof slackWebhookConfigSchema>;
export type DiscordWebhookConfig = z.infer<typeof discordWebhookConfigSchema>;
export type PagerDutyConfig = z.infer<typeof pagerdutyConfigSchema>;
export type TwilioSmsConfig = z.infer<typeof twilioSmsConfigSchema>;
export type GenericWebhookConfig = z.infer<typeof genericWebhookConfigSchema>;
