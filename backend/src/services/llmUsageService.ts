import { prisma } from '../lib/prisma.js';

// ── Pricing per 1M tokens (USD) ─────────────────────────────────
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':               { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':          { input: 0.15,  output: 0.60  },
  'gpt-5-mini':           { input: 0.15,  output: 0.60  },
  'text-embedding-3-small': { input: 0.02, output: 0    },
  'whisper-1':            { input: 0.006, output: 0     }, // per minute, not tokens
};

function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICING[model] || PRICING['gpt-4o-mini'];
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

// ── Track a single LLM call ─────────────────────────────────────

export interface LlmCallParams {
  service: string;    // 'translate', 'search-hyde', 'search-rerank', 'search-expand', 'ai-writing', 'meeting-notes', 'embedding'
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function trackLlmCall(params: LlmCallParams): Promise<void> {
  try {
    const costUsd = calcCost(params.model, params.promptTokens, params.completionTokens);
    await prisma.llmUsage.create({
      data: {
        service: params.service,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        costUsd,
        durationMs: params.durationMs,
        userId: params.userId,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (err) {
    console.error('[llmUsage] failed to track:', err);
  }
}

// ── Helper: extract usage from OpenAI response and track ────────

export function trackFromResponse(
  service: string,
  model: string,
  response: { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } },
  startTime: number,
  userId?: string,
): void {
  const usage = response.usage;
  if (!usage) return;
  trackLlmCall({
    service,
    model,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    durationMs: Date.now() - startTime,
    userId,
  }).catch(() => {});
}

// ── Analytics ────────────────────────────────────────────────────

export interface LlmUsageStats {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  byService: { service: string; calls: number; tokens: number; cost: number }[];
  byModel: { model: string; calls: number; tokens: number; cost: number }[];
  byDay: { date: string; calls: number; tokens: number; cost: number }[];
  topUsers: { userId: string; calls: number; cost: number }[];
}

export async function getUsageStats(days = 30): Promise<LlmUsageStats> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [totals, byService, byModel, byDay, topUsers] = await Promise.all([
    prisma.llmUsage.aggregate({
      where: { timestamp: { gte: since } },
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
    }),
    prisma.$queryRawUnsafe<{ service: string; calls: bigint; tokens: bigint; cost: number }[]>(
      `SELECT service, COUNT(*)::bigint as calls, SUM(total_tokens)::bigint as tokens, SUM(cost_usd) as cost
       FROM llm_usage WHERE timestamp >= $1 GROUP BY service ORDER BY cost DESC`,
      since,
    ),
    prisma.$queryRawUnsafe<{ model: string; calls: bigint; tokens: bigint; cost: number }[]>(
      `SELECT model, COUNT(*)::bigint as calls, SUM(total_tokens)::bigint as tokens, SUM(cost_usd) as cost
       FROM llm_usage WHERE timestamp >= $1 GROUP BY model ORDER BY cost DESC`,
      since,
    ),
    prisma.$queryRawUnsafe<{ date: string; calls: bigint; tokens: bigint; cost: number }[]>(
      `SELECT to_char(timestamp, 'YYYY-MM-DD') as date, COUNT(*)::bigint as calls, SUM(total_tokens)::bigint as tokens, SUM(cost_usd) as cost
       FROM llm_usage WHERE timestamp >= $1 GROUP BY date ORDER BY date`,
      since,
    ),
    prisma.$queryRawUnsafe<{ user_id: string; calls: bigint; cost: number }[]>(
      `SELECT user_id, COUNT(*)::bigint as calls, SUM(cost_usd) as cost
       FROM llm_usage WHERE timestamp >= $1 AND user_id IS NOT NULL GROUP BY user_id ORDER BY cost DESC LIMIT 10`,
      since,
    ),
  ]);

  return {
    totalCost: totals._sum.costUsd ?? 0,
    totalTokens: totals._sum.totalTokens ?? 0,
    totalCalls: totals._count,
    byService: byService.map(r => ({ service: r.service, calls: Number(r.calls), tokens: Number(r.tokens), cost: r.cost })),
    byModel: byModel.map(r => ({ model: r.model, calls: Number(r.calls), tokens: Number(r.tokens), cost: r.cost })),
    byDay: byDay.map(r => ({ date: r.date, calls: Number(r.calls), tokens: Number(r.tokens), cost: r.cost })),
    topUsers: topUsers.map(r => ({ userId: r.user_id, calls: Number(r.calls), cost: r.cost })),
  };
}
