import { z } from 'zod';

/**
 * Runtime validation for everything crossing the network boundary — never
 * trust client data (auth payloads, InspectionReport uploads, settings).
 * Schemas mirror src/types/index.ts by hand rather than being generated
 * from it: the TypeScript types are the UI/scanner contract (see
 * SCHEMA.md), these are the API's own defense, and keeping them separate
 * means a schema bug can't silently disable validation.
 */

export const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const magicLinkRequestSchema = z.object({ email: emailSchema });
export const magicLinkVerifySchema = z.object({ token: z.string().min(20).max(200) });

const deviceInfoSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  platform: z.enum(['macos', 'windows', 'linux']),
  osVersion: z.string().min(1).max(200),
  lastInspectedAt: z.string().nullable(),
  model: z.string().max(200).optional(),
});

const storageFolderSchema = z.object({
  path: z.string().max(1000),
  label: z.string().max(200),
  bytes: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  children: z.array(z.string()).optional(),
  note: z.string().max(500).optional(),
});

const storageSnapshotSchema = z.object({
  totalBytes: z.number().nonnegative(),
  usedBytes: z.number().nonnegative(),
  availableBytes: z.number().nonnegative(),
  capacityPercent: z.number().min(0).max(100),
  reclaimableBytes: z.number().nonnegative(),
  categories: z.array(
    z.object({ label: z.string().max(200), bytes: z.number().nonnegative(), percent: z.number(), colorToken: z.string().max(50) }),
  ),
  largestFolders: z.array(storageFolderSchema).max(50),
  tools: z.array(z.object({ id: z.string().max(200), label: z.string().max(200), path: z.string().max(1000), bytes: z.number().nonnegative() })).max(200).optional(),
});

const cleanupItemSchema = z.object({
  id: z.string().max(200),
  label: z.string().max(200),
  bytes: z.number().nonnegative(),
  risk: z.enum(['Safe', 'Review']),
  path: z.string().max(1000).optional(),
  command: z.string().max(2000).optional(),
});

/** Validates an uploaded InspectionReport. Deliberately permissive on
 * security/performance/developerEnvironment/crypto (empty-shape defaults
 * are fine — those collectors don't exist yet, see
 * docs/NEXT_COLLECTOR.md) but strict on the fields the Storage MVP
 * actually produces, since those are the ones a client could plausibly
 * try to spoof. */
export const inspectionReportSchema = z.object({
  schemaVersion: z.literal('1.0'),
  device: deviceInfoSchema,
  storage: storageSnapshotSchema,
  security: z.object({ malwareIndicatorsFound: z.boolean(), itemsNeedingReview: z.number().nonnegative(), findings: z.array(z.unknown()).max(500) }),
  performance: z.object({ cpuPercent: z.number(), memoryPercent: z.number(), sparkline: z.array(z.number()).max(200), metrics: z.array(z.unknown()).max(200) }),
  developerEnvironment: z.object({ toolCount: z.number().nonnegative(), totalBytes: z.number().nonnegative(), tools: z.array(z.unknown()).max(500) }),
  crypto: z.object({ walletsDetected: z.number().nonnegative(), wallets: z.array(z.unknown()).max(200) }),
  cleanup: z.object({ totalReclaimableBytes: z.number().nonnegative(), items: z.array(cleanupItemSchema).max(500) }),
  collectedAt: z.string().datetime(),
  scannerVersion: z.string().max(50),
});

export const settingsUpdateSchema = z.object({
  preferredAiProvider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter', 'azure-openai', 'ollama']).nullable().optional(),
  preferredAiModel: z.string().max(200).nullable().optional(),
});

export const apiKeyUpsertSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter', 'azure-openai', 'ollama']),
  apiKey: z.string().min(1).max(2000),
});

export const analyzeRequestSchema = z.object({
  reportId: z.string().min(1).max(200),
  provider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter', 'azure-openai', 'ollama']),
  model: z.string().min(1).max(200),
});

export const compareQuerySchema = z.object({
  previousId: z.string().min(1).max(200),
  currentId: z.string().min(1).max(200),
});

export const exportQuerySchema = z.object({
  reportId: z.string().min(1).max(200),
  format: z.enum(['json', 'markdown', 'html']),
});

/** Parses `body` against `schema`, returning either the typed value or a
 * flattened error object suitable for an `invalid_request` API response. */
export function safeParseJSON<T>(schema: z.ZodType<T>, body: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
