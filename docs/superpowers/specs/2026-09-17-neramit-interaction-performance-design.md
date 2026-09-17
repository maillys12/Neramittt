# Neramit Interaction and Performance Design

## Goal
Preserve the approved Neramit visual direction and layout while replacing emoji UI with a coherent custom vector icon system, making platform/language/variant selectors functional end to end, and reducing perceived and actual AI latency.

## Non-negotiable visual constraints
- Keep the approved Neramit layout, gradients, card shapes, hierarchy, mascot direction, and overall color mood.
- Do not redesign Neramit to resemble Stripe, Apple, Vercel, or Linear.
- Use research only to improve spacing discipline, hierarchy, interaction clarity, loading states, and performance patterns.
- Remove emoji from functional UI and replace them with custom SVG icons using the existing Neramit palette and stroke language.
- Preserve responsive behavior for phone, tablet, and desktop.

## Interaction settings
Introduce a shared creation-settings model:
- `platform`: `chatgpt | gemini | canva | generic`
- `language`: `th | en`
- `variantCount`: `1 | 2 | 3`

The controls on Chat and Review must be interactive, accessible, and persist into the draft brief. Form and Review read the same values. Generate uses these values to tailor the prompt output while continuing to use OpenAI as Neramit's backend reasoning/generation service.

## Performance design
Current chat performs several sequential database operations before and after a blocking OpenAI response, and the client waits for the entire response before rendering it. Improve this in two layers:
1. Reduce database round trips where safe: use fixed defaults for non-user-specific settings in the hot path, fetch conversation history and draft in as few requests as practical, and avoid an extra client-side brief refresh by returning the updated brief with the chat response.
2. Improve perceived latency: keep the existing thinking animation, update copy to show progressive states, and use a fast, non-reasoning chat configuration suitable for short creative-brief questions. Generation remains a deliberate blocking action with a full-screen loading state.

## UI research applied without changing the design
- Linear: reduce visual competition, soften separators, and keep secondary navigation visually quieter than the work area.
- Stripe: make the primary next action visually dominant and reduce competing controls around decision points.
- Apple HIG principles: maintain readable type sizes, generous touch targets, and consistent spacing rhythm.
- OpenAI Responses guidance: streaming can improve time-to-first-visible-token; for this pass, first optimize hot-path round trips and model configuration, then add streaming only if measured latency remains unacceptable.

## Custom icon system
Create one reusable SVG icon component with named icons for chat, form/document, language/globe, layers/variants, search, edit, lock, image, settings, history, refresh, send, spark, user, and chevrons. Icons use `currentColor`, rounded strokes, and 1.8-2px stroke weight. Decorative mascot art remains separate from functional icons.

## Error/loading behavior
- Controls disable only while their own mutation is in flight.
- Selector changes optimistically update UI and save to draft in the background when a draft exists.
- AI response shows a Neramit thinking bubble immediately.
- Generation keeps the full loading overlay.
- Errors surface as existing toast UI and never reset user-entered settings.

## Testing
- Unit tests for settings normalization and prompt-target mapping.
- Component-level logic tests where practical for selector state serialization.
- Existing `npm test`, `npm run typecheck`, and `npm run build` must all pass.
- Verify Vercel Preview before merging to production.
