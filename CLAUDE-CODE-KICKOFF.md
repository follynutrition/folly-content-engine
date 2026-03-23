# CLAUDE CODE KICKOFF PROMPT
# Copy everything below this line and paste into Claude Code

---

Build the Folly Content Engine — a web app that manages a monthly pipeline of 100 segment-targeted blog+email packages for Folly Nutrition's lifecycle marketing.

## Context Files (read all before writing any code)

1. `folly-content-engine-prd-v2.md` — The product spec. What to build, requirements, constraints, system prompts, compliance rules, honest boundaries about what's V1 vs V1.1. START HERE.

2. `folly-content-engine-design-v2.md` — The design system. "Midnight Studio" aesthetic: warm dark palette, Folly magenta accents, Instrument Serif + DM Sans + JetBrains Mono typography, all 8 views specced with layout, interaction, and state details. Match this exactly.

3. `folly-content-engine-v3.jsx` — A working React prototype. Use as a VISUAL REFERENCE for feel and flow, but rebuild from scratch with proper architecture. The prototype has known limitations documented in the PRD.

4. `/config/` folder — 9 importable config files. READ THE README.md FIRST. These contain system prompts, compliance rules, segment definitions, email template HTML, topic brief schema, and CSV template. Import these as modules — do not hardcode values that exist in these files.

## Tech Stack

- React (Next.js or Vite — your call, but it deploys to Vercel)
- TypeScript
- Tailwind CSS (customize with the design system's color/spacing/radius tokens — do NOT use default Tailwind colors)
- localStorage for state persistence (no backend for V1)
- Claude API for content generation (Anthropic SDK)
- Gemini Pro API for image generation
- Klaviyo MCP for campaign creation (mock this for now — build the integration interface but use fake responses until we validate the MCP in week 1)

## Architecture Decisions Already Made

- **Workflow model:** Each of 4 segments has independent pipeline state (6 phases). Segments advance independently. Run Home shows all 4 with a single CTA per segment. See PRD Section 6.
- **Research phase:** Two paths — in-app Google search (primary) or CSV/JSON import from NotebookLM (secondary). Both feed the same topic brief format. See PRD Section 6, Phase 1.
- **Images:** Gemini Pro API called directly from the app. Per-image QA with accept/reject+regenerate/swap. See PRD requirement #6.
- **Publish:** Three sequential sub-steps (schedule preview → export blogs CSV → create Klaviyo campaigns). Blog URLs must be captured before campaigns are created. See PRD Section 6, Phase 6.
- **Compliance:** Client-side scanner using regex rules from `/config/compliance-rules.json`. Runs after content generation and live during editing. See PRD requirement #5.
- **State:** localStorage. Each monthly cycle is a "Run" (e.g., "March 2026"). Runs persist across sessions. Previous Runs viewable for reference.

## Build Order

Build in this order. Get each view working before moving to the next:

1. **Scaffold + Design System** — Set up the project, install deps, configure Tailwind with the design tokens from the design brief (colors, fonts, spacing, radius). Build the top bar (logo + segment selector) and phase stepper component. These are on every view.

2. **Run Home (View 1)** — The launchpad. Shows all 4 segments with their current phase, progress bar, and one CTA button each. This is the app's entry point. Must read/write segment state from localStorage.

3. **Topic Import (View 2)** — Drag-and-drop CSV/JSON upload zone. Schema validation from `/config/topic-brief-schema.json`. Display imported topics as a checklist with inline editing. This is where the "Skip to import" path from research lands.

4. **Content Generation (View 3)** — Calls Claude API with prompts from `/config/prompt-blog-generator.json` and `/config/prompt-email-teaser-generator.json`. Packages stream in one-by-one. Compliance scanner runs from `/config/compliance-rules.json` after each package. Each card shows "Answering: '...'" source question. Flagged packages auto-set to "Needs Edit."

5. **Review (View 5)** — Flip-through mode: blog (left 55%) + email (right 45%) on white cards against dark chrome. Actual images visible (or "IMAGE MISSING" state). Package dot navigation. Approve/Reject/Edit with keyboard shortcuts (A/R/E/←→). Inline edit mode: fields become inputs with live counts and compliance re-scanning. List mode toggle (L key).

6. **Image Generation (View 4)** — Build the prompt construction from `/config/prompt-image-generator.json`. For now, mock the Gemini API response with placeholder images and realistic delays. Build the per-image QA controls (accept/reject+regen/swap). Wire up real Gemini Pro API after the UI is solid.

7. **Publish (Views 6-7)** — Schedule preview (calendar/list of sends per day). Matrixify CSV export button. Klaviyo campaign creation (mock the MCP — build the interface, show per-campaign status, handle "failed" state with retry). Post-publish receipt with clickable blog URLs and campaign statuses.

8. **Research (View — phase 1)** — In-app Google search using site:reddit.com queries from `/config/segments.json`. Results stream in with source, question, upvotes, emotion tag. "Skip to Topic Import" always visible. This can be last because the CSV import path works without it.

## What to Mock vs Build Real

**Build real:**
- All UI, state management, localStorage persistence, navigation, keyboard shortcuts
- Claude API integration for content generation (use the Anthropic SDK)
- Compliance scanner (client-side, from config)
- CSV/JSON import with schema validation
- Matrixify CSV export
- Email template HTML injection (from `/config/email-template.html`)

**Mock for now (build the interface, use fake data/delays):**
- Klaviyo MCP campaign creation (we need to validate the MCP works in week 1)
- Gemini Pro API image generation (build prompt construction + QA UI, use gradient placeholders for images)
- Google search for research phase (use the mock data pattern from the prototype, wire up real search later)

## Quality Bars

- The app should feel like Linear or Figma — fast, keyboard-driven, dense but not cluttered
- Dark mode is the default and only mode for V1
- Every view must have proper loading states (skeleton shimmer, not spinners)
- Every error must have a recovery path (retry button, fallback action)
- The compliance scanner must catch every rule in the config — test it against the example CSV data
- Segment colors from `/config/segments.json` must be the only source of truth — if you find yourself hardcoding a color like "#5B9A8B", stop and import it from config
- Typography: Instrument Serif for content preview headlines, DM Sans for UI, JetBrains Mono for data/status labels. Load from Google Fonts.

## Deployment

This deploys to Vercel. Make sure the build works with `npm run build` before shipping. Environment variables needed:
- `ANTHROPIC_API_KEY` (for Claude content generation)
- `GEMINI_API_KEY` (for image generation — can be empty until we wire it up)

Start building. Read the PRD and design brief fully before writing any code.
