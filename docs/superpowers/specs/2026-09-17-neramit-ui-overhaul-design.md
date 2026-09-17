# Neramit UI Overhaul Design

**Date:** 2026-09-17

## Goal

Rebuild the existing Neramit frontend so the production site closely matches the approved desktop and mobile mockups supplied by the user, while preserving the working Vercel + Supabase + OpenAI backend and all current routes and data flows.

This is a visual and interaction overhaul, not a backend rewrite.

## Master design direction

The supplied mockups are the visual source of truth. The production implementation should reproduce their overall hierarchy, spacing, rounded card system, bright accent colors, Thai-first typography, playful illustrated personality, and responsive behavior as closely as practical in a real web layout.

The visual language is:

- warm off-white page background
- deep navy primary text
- orange / pink / magenta / violet gradient accents
- soft blue, lavender, yellow, orange, and pink secondary surfaces
- thin cool-gray borders
- generous rounded corners
- subtle soft shadows rather than heavy elevation
- playful pencil mascot and decorative spark / blob motifs
- clean, readable Thai typography with strong heading contrast

## Non-negotiable product constraints

- Preserve all existing API contracts and production backend behavior unless a frontend bug proves a backend change is required.
- Preserve the anonymous device-token model and current quota behavior.
- Preserve routes: `/`, `/chat`, `/form`, `/references`, `/review`, `/result`, `/history`, `/admin`.
- Do not reintroduce Google Apps Script dependencies.
- Do not expose Supabase service credentials or OpenAI credentials to the browser.
- All interactive controls must remain usable by touch on phones and tablets.
- All pages must support reduced-motion users.

## Responsive layout system

The interface must be designed from fluid layout rules rather than scaling the desktop mockup down mechanically.

### Desktop

- Main content width: approximately 1120–1220 px.
- Typical page gutters: 24–32 px.
- Header remains single-row.
- Two-column content is preferred where shown in the mockups, such as Chat + Summary and Review + Generation Settings.
- Primary content should not become excessively wide; long text blocks remain constrained for readability.

### Tablet

- 768–1100 px uses a compressed desktop / expanded mobile layout.
- Two-column sections may remain two columns while both columns remain readable; otherwise collapse to one column.
- Touch targets remain at least about 44 px tall.

### Mobile

- Below roughly 760 px use a true mobile composition.
- Main gutters: 14–18 px.
- Header navigation collapses behind a menu button where needed.
- Cards become full-width and vertically stacked.
- Side summaries become collapsible panels or move below primary content.
- Sticky bottom actions may be used when the mockup implies a persistent next action.
- Horizontal scrolling must not be required for normal content.

## Typography

Use `Noto Sans Thai` or an equivalently readable Thai web font with system fallbacks.

Target scale:

- Hero heading: fluid `clamp()` approximately 38–72 px desktop, 34–46 px mobile depending on viewport.
- Page heading: approximately 34–48 px desktop, 28–34 px mobile.
- Section title: 20–28 px.
- Card title: 18–24 px.
- Body: 15–17 px mobile, 16–18 px desktop.
- Helper / metadata: never smaller than roughly 12–13 px, preferably 13–14 px.
- Line height: about 1.45–1.7 for Thai body text.

Text should never be reduced simply to force a desktop layout onto mobile.

## Design tokens

Create shared CSS variables for at least:

- `--ink: #111a56`
- `--muted: #6f7892`
- `--surface: #ffffff`
- `--canvas: #fffdf8`
- `--line: #e2e6f1`
- `--lavender: #f3efff`
- `--blue-soft: #edf7ff`
- `--yellow-soft: #fff5cc`
- `--pink-soft: #fff0f6`
- accent orange, pink, violet, blue, green, red
- primary gradient: orange → pink → violet
- card radius around 20–28 px
- control radius around 12–16 px
- soft shadow tokens
- focus ring token

## Shared UI components

Introduce focused shared components rather than duplicating styling page by page:

- `AppHeader`
- `BrandMark`
- `QuotaPill`
- `MobileMenu`
- `PageShell`
- `SectionCard`
- `GradientButton`
- `SecondaryButton`
- `IconButton`
- `Badge`
- `ChoiceChip`
- `LoadingOverlay`
- `InlineSpinner`
- `SkeletonBlock`
- `AiThinkingBubble`
- `Toast`
- `EmptyState`

The pencil mascot may initially be an inline SVG / CSS illustration so the site does not depend on a remote asset. Its job is to reinforce the visual identity in headers, empty states, and assistant messages without overwhelming content.

## Loading and waiting behavior

Every action that legitimately waits on a network or AI response must make that wait explicit.

### Required states

- Device / quota initialization: small skeleton or shimmer in the quota pill.
- Create draft: button busy state.
- Send chat message: disable repeated submit, show user message immediately, then show an assistant thinking bubble.
- AI thinking bubble: animated three-dot sequence with subtle pulse / shimmer; replace it with the final reply.
- Reference upload: per-file loading/progress state.
- Reference analysis: analysis skeleton / loading card.
- Review fetch: structured skeleton matching the review layout.
- Prompt generation: blocking generation overlay or prominent in-card state showing that Neramit is creating the prompt.
- History/admin fetches: skeleton rows/cards rather than blank screens.

Loading states must never fake progress percentages unless actual progress data exists.

Reduced-motion mode disables pulsing / sliding animation but still shows a clear textual loading state.

## Home page

Desktop should closely follow the first mockup:

- Branded header with logo, Create Prompt, History, How to Use, quota pill, and compact account/menu affordance.
- Large centered hero headline with second line in the orange-pink-violet gradient.
- Short explanatory subtitle.
- Playful pencil illustration and small decorative annotations / shapes.
- Two large action cards: Chat with Neramit and Quick Form.
- Each card has a recognizable illustration/icon, short explanation, and strong CTA.
- A compact supported-platform strip may show ChatGPT, Gemini, Canva AI, and Generic Prompt as visual context only; it must not imply integrations that do not exist.

Mobile:

- Logo + menu header.
- Quota remains visible near the top.
- Hero text remains prominent but not oversized.
- Illustration is smaller and decorative.
- Action cards stack vertically with large tap targets.

## Chat page

Desktop follows the second mockup:

- Left primary conversation panel.
- Right live summary panel showing known brief fields.
- Compact top controls for platform, language, and variant count where applicable.
- Assistant messages use a soft blue / lavender bubble and mascot/avatar treatment.
- User messages use a warm peach / pink surface.
- Suggested quick-answer chips may appear when the AI asks a choice-like question.
- Composer stays visually anchored at the bottom of the chat card.
- Reference thumbnails may appear above the composer when attached.

Mobile:

- Chat remains the primary visible area.
- Brief summary becomes a collapsible section.
- Composer stays large enough for touch and respects safe-area insets.

### Chat AI behavior

The assistant should ask only the most important missing information, normally one or two topics per response, rather than dumping a seven-item questionnaire.

The UI thinking state begins immediately after the user sends a message and ends only after the API returns or fails.

## Quick Form page

Follow the third mockup:

- Branded page heading.
- Top row for platform, prompt language, and variant count.
- Desktop two-column form: core poster data on the left; style/reference settings on the right.
- Clear grouped sections with strong labels.
- Style choice chips.
- Color chips / color picker affordance.
- Aspect ratio choice buttons.
- Reference image upload area.
- Exclusion / unwanted-content section.
- Large Review / Next CTA.

Mobile becomes a vertical step-like flow without shrinking controls.

## References page

Follow the fourth mockup:

- Reference gallery / thumbnails.
- Large selected preview.
- AI analysis card for the selected image.
- Editable visible-text field.
- Explicit checkboxes/chips for which aspects to use: color, composition, subject, background, visible text.
- Clear warning that AI analysis may be inaccurate and should be reviewed.
- Primary confirm-and-review CTA.

## Review page

Replace raw JSON completely.

Follow the fifth mockup:

- Human-readable summary cards.
- Work details, poster text, and reference images are presented separately.
- Generation settings remain editable or visibly summarized.
- Variant count is clear.
- Quota cost is shown before generation.
- Large primary Generate Prompt CTA.
- Back-to-edit button remains available.

No implementation should expose raw JSON to normal users.

## Result page

Follow the sixth mockup:

- Strong success heading.
- Variant tabs when more than one prompt exists.
- Prompt displayed in a readable structured card.
- One-tap copy with a visible copied-success state.
- Short usage guidance panel.
- Links to edit details, create again, and history.
- Show saved-to-history confirmation.

## History page

Follow the seventh mockup:

- Search.
- Platform filter.
- Sort control.
- Prompt cards / rows containing title, timestamp, short summary, platform/language/variant metadata.
- Open and Use as Template actions.
- Destructive remove actions require confirmation.
- Delete-all requires a strong confirmation modal.
- Mobile cards stack metadata and actions cleanly.

## Admin page

Follow the eighth mockup:

- Admin-specific branded shell.
- Desktop sidebar; mobile compact navigation.
- KPI cards for jobs today, active devices, token usage, and errors.
- Seven-day usage visualization.
- Platform usage visualization.
- Recent jobs table/cards.
- Quick controls / maintenance controls.
- Existing admin authentication and authorization remain unchanged.

Charts should use simple CSS/SVG rendering unless a chart library is already justified; do not add a large dependency solely for decorative charts.

## Interaction rules

- Buttons include hover, active, disabled, focus-visible, and loading states.
- Avoid disabling UI without explaining why.
- Use optimistic UI only where failure can be safely reconciled.
- Network errors appear as styled toasts / inline errors, not browser `alert()` for normal user flows.
- Confirmation dialogs are used for destructive actions.
- Copy actions display a brief success state.
- Form errors appear near the relevant field.

## Accessibility

- Semantic headings.
- Real `button`, `label`, `input`, and link elements.
- Visible focus states.
- Minimum reasonable color contrast for body text and controls.
- Touch targets approximately 44 px or larger.
- Loading text is understandable without animation.
- `aria-live` is used for chat thinking/reply status and important async feedback where appropriate.

## Implementation phases

### Phase 1 — Foundation + Home + Chat

- Establish design tokens and shared layout components.
- Rebuild header and Home page to match the approved mockup.
- Rebuild Chat layout, brief summary panel, composer, message styling, and AI thinking animation.
- Keep existing Chat API behavior intact.

### Phase 2 — Quick Form + References

- Rebuild Quick Form controls and responsive grouping.
- Rebuild reference gallery, preview, analysis, aspect selection, and loading states.

### Phase 3 — Review + Result

- Remove raw JSON from Review.
- Add human-readable summary and generation controls.
- Rebuild Result, variant tabs, copy states, and guidance.

### Phase 4 — History + Admin

- Rebuild history search/filter/list/actions and confirmations.
- Rebuild admin dashboard, stats, jobs, controls, and mobile layout.

### Phase 5 — Cross-device polish

- Verify representative widths around 360, 390, 430, 768, 834, 1024, 1280, and 1440 px.
- Fix overflow, awkward wrapping, undersized text, excessive card height, and inconsistent spacing.
- Verify touch, keyboard focus, reduced motion, loading, empty, success, and error states.

## Testing strategy

Frontend changes must not be considered complete from a successful build alone.

At minimum:

- `npm test`
- `npm run typecheck`
- `npm run build`
- component/helper tests for loading-state logic and UI state transformations where practical
- production or preview smoke checks for all eight routes
- verify existing API routes still return their expected statuses
- manual responsive review at representative phone, tablet, and desktop widths

## Success criteria

The UI overhaul is complete when:

- the production UI is recognizably the same product shown in the approved mockups
- typography and spacing are readable and balanced on phone, tablet, and desktop
- no normal user-facing page exposes raw JSON
- every async AI/network action has an intentional loading state
- Chat shows an AI thinking animation while awaiting the response
- buttons and cards do not become unreasonably small or oversized across supported viewports
- core flows still work end to end without changing backend semantics
- tests, typecheck, and production build pass
