import { zodTextFormat } from 'openai/helpers/zod';
import { getOpenAI } from '@/lib/openai/client';
import { buildChatInstructions } from '@/lib/ui/chat-instructions';
import { AssistantTurnSchema, type AssistantTurn, type SourceRef } from '@/lib/chat/contracts';
import type { CreationSettings } from '@/lib/ui/creation-settings';

export type ResearchGenerationInput = {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  settings: CreationSettings;
  assets: Array<{ id: string; kind: 'logo' | 'reference'; authentic: boolean; label?: string }>;
  officialContext: boolean;
  repairReasons?: string[];
};

type CitationResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      annotations?: Array<{ type?: string; title?: string; url?: string }>;
    }>;
  }>;
};

function sourceTypeForDomain(domain: string): SourceRef['sourceType'] {
  if (/\.(?:go|ac)\.th$|\.gov$|\.edu$/i.test(domain)) return 'official';
  return 'primary';
}

export function normalizeSources(response: CitationResponse) {
  const sources = new Map<string, SourceRef>();
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      for (const annotation of part.annotations ?? []) {
        if (annotation.type !== 'url_citation' || !annotation.url) continue;
        try {
          const url = new URL(annotation.url);
          const canonical = `${url.origin}${url.pathname}`.replace(/\/$/, '') || url.origin;
          sources.set(canonical, {
            title: annotation.title?.trim() || url.hostname,
            url: annotation.url,
            domain: url.hostname,
            sourceType: sourceTypeForDomain(url.hostname),
          });
        } catch {
          // Invalid model citations are discarded rather than shown to users.
        }
      }
    }
  }
  return [...sources.values()].slice(0, 20);
}

export async function generateResearchTurn(input: ResearchGenerationInput): Promise<AssistantTurn> {
  const ai = getOpenAI();
  const model = process.env.NERAMIT_RESEARCH_MODEL || 'gpt-5.6-luna';
  const research = await ai.responses.create({
    model,
    reasoning: { effort: 'low' },
    store: false,
    max_output_tokens: 1400,
    tools: [{ type: 'web_search', search_context_size: 'medium' }],
    instructions: [
      'Research the user request before any creative recommendation.',
      'Use at least one web search. Prefer official and primary sources, especially for named organizations.',
      'Verify official names, identity guidance, terminology, and current facts. For fact-free work, research relevant current design and domain conventions.',
      'Research the communication conventions of the job type so the result functions as a real poster, announcement, campaign, sign, cover, or advertisement rather than a generic decorative image.',
      'Return a concise evidence summary. Do not invent missing facts and do not copy long passages.',
    ].join('\n'),
    input: input.message,
  });
  const researchText = research.output_text?.trim();
  if (!researchText) throw new Error('RESEARCH_FAILED');
  const sources = normalizeSources(research);

  const generation = await ai.responses.parse({
    model,
    reasoning: { effort: 'low' },
    store: false,
    max_output_tokens: input.settings.variantCount === 3 ? 2600 : input.settings.variantCount === 2 ? 2100 : 1700,
    instructions: buildChatInstructions(input.settings),
    input: JSON.stringify({
      userMessage: input.message,
      recentConversation: input.history.slice(-12),
      researchFindings: researchText,
      verifiedSources: sources,
      suppliedAssets: input.assets,
      officialContext: input.officialContext,
      repairReasons: input.repairReasons ?? [],
    }),
    text: { format: zodTextFormat(AssistantTurnSchema, 'assistant_turn') },
  });
  if (!generation.output_parsed) throw new Error('PROMPT_FORMAT_FAILED');
  const turn = AssistantTurnSchema.parse(generation.output_parsed);
  return turn.type === 'final' ? { ...turn, sources } : turn;
}
