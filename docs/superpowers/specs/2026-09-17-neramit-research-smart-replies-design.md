# Neramit Research-Driven AI, Smart Reply Cards, and Live Work Statuses

**Date:** 2026-09-17

**Status:** Proposed for owner review

**Scope:** AI conversation and prompt-generation experience only

**Out of scope:** AI tier packaging/pricing and direct image-generation changes

## 1. Purpose

Neramit must stop behaving like a generic prompt formatter. It will act as a research-driven creative strategist that can understand an incomplete request, verify relevant context, decide what should and should not appear, propose missing copy, and produce a polished image-generation prompt in the language selected by the user.

This release also replaces rigid clarification flows with Smart Reply Cards and replaces the single static “thinking” label with truthful, localized work statuses emitted by the server as the real pipeline advances.

## 2. Product principles

1. **Research before final output.** Every final prompt-generation job passes through the research gate and executes at least one relevant web search. Factual requests verify their subject matter; fact-free creative requests research current domain and design conventions instead of skipping research.
2. **Official sources first.** Institutional identity, official names, colors, symbols, and public contact information are verified against the organization’s own website or another authoritative primary source whenever available.
3. **No invented official assets or facts.** The AI must never fabricate a logo, seal, date, salary, phone number, URL, address, qualification, or official title.
4. **Creative judgment, not transcription.** The AI may recommend headlines, subheads, body copy, CTA, information hierarchy, composition, visual metaphors, and omissions based on the request and research.
5. **User-selected language governs the complete experience.** Thai mode produces advanced Thai conversation, cards, copy suggestions, and final prompts. English mode produces advanced English equivalents.
6. **Truthful progress.** UI statuses correspond to server pipeline stages. The client must not display random progress, fake percentages, or stages the server did not perform.
7. **User remains in control.** The user can type freely at all times, reject AI suggestions, provide exact copy, and upload official assets.

## 3. User experience

### 3.1 Conversation start

The existing creation settings remain the source of truth for output language, aspect ratio, model target, style, and other generation parameters. The selected `PromptLanguage` is passed with every turn and controls all AI-visible text returned to the user.

The assistant first determines whether it can create a strong result immediately. It asks a question only when the missing answer materially changes factual correctness, visual direction, required copy, or official-brand treatment.

### 3.2 Smart Reply Cards

When a question has a small set of useful answers, the assistant returns a structured single-choice interaction:

- 2–5 concise, mutually distinct cards.
- A short user-facing label plus a machine-stable value.
- An optional “Other” card when free-form input is useful.
- The normal composer remains available even when cards are shown.

Selecting a card must:

1. append the selected answer as a user message immediately;
2. disable the originating card group so it cannot be submitted twice;
3. send the stable value and visible label to the server;
4. preserve the current draft and creation settings;
5. move keyboard focus to the new assistant response or custom input.

Selecting “Other” opens a focused custom-answer input. A card group becomes stale and non-interactive after any later user turn. Existing historical messages that contain only plain text continue to render normally.

### 3.3 Research and content judgment

Before generating a final prompt, the assistant builds or refreshes a research snapshot. It identifies:

- the subject, organization, place, audience, channel, and purpose;
- verified names, terminology, identity guidance, and relevant domain conventions;
- information the user supplied versus information independently verified;
- suggested copy that is creative rather than official fact;
- elements that should be included, excluded, or reserved for later insertion;
- unresolved high-risk facts that require user confirmation.

For every final prompt-generation request, the research gate runs. Repeated turns inside the same draft may reuse the current snapshot for conversational questions, but final generation refreshes materially time-sensitive or changed facts before producing prompts.

### 3.4 Official organization and logo handling

For a request such as an official Faculty of Medicine, Khon Kaen University poster, the assistant researches the official unit name, brand context, and relevant visual conventions. It then applies these rules:

- If the user has supplied an authentic logo or reference asset, the prompt may instruct the image workflow to place that supplied asset unchanged.
- If no authentic asset is available, the prompt reserves an appropriate logo area and asks the user to provide the official file; it must not ask an image model to recreate or approximate the logo.
- Verified brand colors may guide the concept only when supported by an official or authoritative source.
- Formal-looking decorative emblems, seals, medical symbols, or accreditation marks are excluded unless appropriate and verified.
- Essential factual text that is still unknown is represented as a clearly marked content placeholder outside the generated artwork, not invented inside the image.

The same policy applies to universities, government agencies, hospitals, companies, associations, and other identifiable organizations.

### 3.5 Copy assistance

The final response separates recommended copy from the visual-generation prompt. Copy suggestions can include:

- headline;
- supporting headline or value proposition;
- essential information blocks;
- qualifications or feature summaries based only on verified/user-provided facts;
- CTA;
- a list of facts the user must supply;
- content that should be omitted because it is redundant, risky, unverified, or visually overcrowded.

Suggestions are editable and explicitly labeled as suggestions. Official facts and creative proposals are never presented as the same category.

### 3.6 Final response

The final assistant turn contains:

- one or more ready-to-use prompt variants;
- recommended copy;
- include/exclude recommendations with short reasons;
- source links used for factual or identity decisions;
- warnings or requested assets when official material is unavailable;
- an updated structured brief patch.

Thai mode produces polished, natural Thai rather than a literal translation. English mode produces professional English. Both modes retain the same information quality and safety constraints.

## 4. Live work statuses

The server emits stage events as real work begins. The client displays the most recent stage until a new event, final turn, or error arrives.

| Stage key | Thai | English | Emission condition |
|---|---|---|---|
| `analyzing` | กำลังวิเคราะห์คำขอ | Analyzing your request | Request accepted and parsed |
| `researching` | กำลังค้นคว้าข้อมูลที่เกี่ยวข้อง | Researching relevant information | Web research starts |
| `identity_check` | กำลังตรวจสอบอัตลักษณ์และแหล่งข้อมูลทางการ | Checking official identity and sources | Named organization or official work detected |
| `concept` | กำลังวางแนวคิดและลำดับข้อมูล | Developing the concept and hierarchy | Creative strategy starts |
| `copywriting` | กำลังร่างข้อความที่เหมาะสม | Drafting suitable copy | Copy recommendations are being produced |
| `prompting` | กำลังเขียนพรอมต์ฉบับสมบูรณ์ | Writing the complete prompt | Prompt variants are being generated |
| `quality_check` | กำลังตรวจสอบความถูกต้องและคุณภาพ | Checking accuracy and quality | Validators and factual checks run |
| `finalizing` | กำลังจัดเตรียมคำตอบ | Preparing the response | Final structured turn is serialized |

Stages that do not apply are not emitted. There is no estimated percentage. A slow stage may show elapsed time after ten seconds, but this is informational and must not imply progress.

## 5. Technical architecture

### 5.1 API transport

`POST /api/chat` changes from a single JSON response to a newline-delimited JSON stream (`application/x-ndjson`). This transport supports application-level status events while keeping the existing Next.js route and fetch client.

Each line is one schema-validated event:

```ts
type ChatStreamEvent =
  | { type: 'stage'; stage: WorkStage }
  | { type: 'turn'; turn: AssistantTurn }
  | { type: 'error'; code: ChatErrorCode; message: string; retryable: boolean }
  | { type: 'done'; requestId: string };
```

The client reads the stream incrementally, updates the status on `stage`, persists and renders the structured response on `turn`, and closes busy state only after `done` or `error`.

Each request includes a client-generated `requestId`. The server uses it to prevent accidental duplicate persistence when the client retries after a connection interruption.

### 5.2 Server pipeline

The route delegates to modules with explicit responsibilities:

1. `request-normalizer` validates settings, user input, card selections, and uploaded-asset metadata.
2. `intent-analyzer` identifies subject, purpose, named entities, missing critical details, and research needs.
3. `research-provider` uses the OpenAI Responses API web-search tool and returns normalized sources and findings.
4. `identity-policy` applies official-source and asset rules.
5. `turn-generator` returns a schema-constrained `AssistantTurn` in the selected language.
6. `quality-gate` validates language, required structure, unsupported facts, prompt completeness, and asset safety; it permits one repair pass.
7. `turn-persistence` stores the plain-text summary plus structured metadata without breaking historical rows.

The implementation keeps the current configured model default (`gpt-5.6-luna`) behind an environment-configurable model name. Startup/health verification must detect whether the configured model supports the required Responses API web-search and structured-output capabilities. An unsupported configuration fails explicitly instead of silently skipping research.

The design relies on the documented OpenAI Responses API capabilities:

- [Web search tool](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses)

### 5.3 Structured assistant turn

```ts
type SourceRef = {
  title: string;
  url: string;
  domain: string;
  sourceType: 'official' | 'primary' | 'secondary';
};

type SmartReplyOption = {
  id: string;
  label: string;
  value: string;
  kind: 'choice' | 'custom';
};

type AssistantTurn =
  | {
      type: 'question';
      message: string;
      interaction?: {
        type: 'single_choice';
        options: SmartReplyOption[];
        allowCustom: boolean;
      };
      briefPatch: Record<string, unknown>;
    }
  | {
      type: 'final';
      message: string;
      prompts: Array<{ id: string; label: string; content: string }>;
      copySuggestions: {
        headline?: string;
        subheadline?: string;
        body?: string[];
        cta?: string;
        missingFacts: string[];
      };
      recommendations: {
        include: Array<{ item: string; reason: string }>;
        exclude: Array<{ item: string; reason: string }>;
      };
      sources: SourceRef[];
      warnings: string[];
      briefPatch: Record<string, unknown>;
    };
```

The server validates this shape with Zod before streaming it to the browser. Labels, messages, explanations, suggestions, and prompt content must match the selected language. Stable keys and enum values remain English internally.

### 5.4 Language-aware prompt policy

The current policy that rejects all Thai characters is replaced by a language-aware validator:

- `language = 'th'`: require advanced Thai prompt prose and Thai section labels; English proper nouns and technical terms remain allowed when appropriate.
- `language = 'en'`: require English prompt prose and English section labels; Thai source names may appear only when they are required official names or supplied copy.

Both languages validate equivalent conceptual sections: subject/context, visual direction, composition, color/lighting, text-space guidance, constraints/negative guidance, and generation parameters.

Long or exact copy should not be delegated to raster image generation when legibility matters. The assistant provides the copy separately and instructs the visual prompt to reserve space, unless the target workflow is known to support reliable text rendering.

### 5.5 Persistence

Add a backward-compatible metadata column with a safe default for existing rows:

```sql
alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;
```

`content` remains the searchable/displayable text representation. `metadata` stores the structured interaction, prompts, copy suggestions, research source references, warnings, selected-card information, and `requestId`.

The draft brief JSON stores the latest normalized `researchSnapshot`, `identityAssets`, `copySuggestions`, and recommendation state. It does not store copied web-page bodies.

No secret keys, private uploaded-file URLs, or raw hidden reasoning are persisted.

### 5.6 UI components

The chat UI adds:

- `SmartReplyCards` for schema-driven card groups;
- `CustomReplyInput` for the “Other” path;
- `WorkStatusBubble` for localized server stages;
- `PromptResultCard` for copyable prompt variants;
- `CopySuggestionsCard` and `ResearchSources` for structured final details.

All controls use the existing Neramit design system and SVG/icon rules. Buttons are semantic, keyboard-operable, visibly focused, and labeled for assistive technology. Mobile layouts stack cards; larger screens may use a compact grid. Motion respects `prefers-reduced-motion`.

## 6. Research, factual safety, and failure behavior

### 6.1 Source policy

- Prefer official organization domains and primary sources.
- Attach source URLs to every externally verified identity or factual decision.
- Treat search snippets as discovery material, not sufficient proof when the official page is reachable.
- Separate verified findings, user-provided claims, and creative suggestions in the internal state.
- Never quote or copy large source passages into the result.

### 6.2 Research failure

If web research fails:

- For official, factual, regulated, medical, educational, recruitment, financial, or time-sensitive work, do not silently produce a final official-looking prompt. Return a localized, retryable error or ask the user whether to continue with clearly marked placeholders and unverified creative direction.
- For a generic creative request with no material factual dependency, the assistant may continue only if it clearly states that live research was unavailable and avoids factual claims.

### 6.3 Validation failure

Structured-output or quality validation receives one repair attempt. If it still fails, the API emits a safe, localized error with a retry option. It must never fall back to malformed JSON rendered as chat text.

### 6.4 Connection failure

The client preserves the unsent/selected user turn, stops the active status, and offers retry using the same `requestId`. Persistence deduplication prevents duplicate messages.

## 7. Performance and operational limits

Research quality takes priority over the current one-call latency, but the pipeline remains bounded:

- maximum research queries and sources are configured server-side;
- official named entities receive primary-source searches before broader searches;
- duplicate sources are normalized by canonical URL;
- only concise findings and citations enter generation context;
- abort signals propagate when the user cancels or the connection closes;
- request duration, stage duration, tool usage, validation failures, and retry counts are logged without storing secret or private prompt data.

Vercel function duration and streaming behavior must be verified in Preview before production promotion. The existing deployment and rollback workflow remains unchanged.

## 8. Compatibility and rollout

- Existing plain-text messages and drafts continue to load.
- The renderer supports both legacy string messages and new structured metadata.
- The old non-streaming response parser remains only as a temporary compatibility path for in-flight older clients during rollout.
- A server-side feature flag, `NERAMIT_RESEARCH_CHAT_V2`, controls the new pipeline in Preview and Production.
- Database migration deploys before enabling the flag.
- Preview verification covers Thai and English, mobile and desktop, new and existing chats, and at least one official-institution scenario.
- Production rollout begins with the flag disabled, then enables after Preview verification; rollback disables the flag without reverting the database column.

## 9. Test and acceptance criteria

### 9.1 Automated tests

- Zod schemas accept every supported stream event and reject malformed events.
- Thai mode accepts Thai prompts and rejects predominantly English output that violates the selected mode.
- English mode enforces English while allowing necessary official Thai names.
- Official-logo requests never instruct the model to invent, redraw, or approximate an absent logo.
- Supplied authentic-asset metadata permits placement instructions without modifying the asset.
- Smart Reply Cards allow one selection, disable stale groups, and preserve free typing.
- “Other” focuses and submits custom input.
- Stage labels localize correctly and are shown only for received server events.
- Research failure follows the high-risk and generic-request policies.
- One repair attempt occurs after invalid structured output, followed by a safe error if still invalid.
- Retrying the same `requestId` does not create duplicate persisted messages.
- Existing legacy messages and drafts still render.

### 9.2 End-to-end acceptance scenarios

1. **Thai official recruitment poster:** The user asks for a square lecturer-recruitment poster with incomplete details. The assistant researches the institution, proposes missing copy, flags unknown recruitment facts, requests/reserves an official logo, offers useful Smart Reply Cards, and returns an advanced Thai prompt without invented information.
2. **English institutional poster:** The same flow in English produces English cards, statuses, copy, rationale, and final prompts with equivalent quality.
3. **Generic creative poster:** The assistant researches relevant conventions, avoids unnecessary institutional questions, suggests concise copy, and completes the prompt.
4. **Research outage:** An official request stops safely with a retry/placeholder choice, while a fact-free creative request may continue with a visible warning.
5. **Interrupted stream:** The client shows the last real stage, reports the interruption, and retries without duplicate messages.

## 10. Definition of done

The feature is complete when:

- all automated tests pass;
- the database migration is applied and backward compatible;
- both language modes satisfy the acceptance scenarios;
- live statuses match emitted server stages;
- official identity and logo safety rules are demonstrated in tests;
- Preview is verified end to end in a real browser;
- Vercel logs show no uncaught stream or persistence errors;
- the feature flag is safely enabled in Production and the production flow is smoke-tested;
- the implementation and deployment commits are present in GitHub with no unrelated generated files included.
