# Folly Content Engine — Config Files

These files are imported by the Content Engine app at build time. Claude Code should
reference these directly — they contain the system prompts, validation rules, templates,
and segment definitions the app needs to function.

## Files

| File | Purpose | Used By |
|------|---------|---------|
| `prompt-blog-generator.json` | Claude API system prompt + user prompt template for blog generation | Phase 3 (Content Generation) |
| `prompt-email-teaser-generator.json` | Claude API system prompt + user prompt template for email teaser generation | Phase 3 (Content Generation) |
| `prompt-image-generator.json` | Gemini Pro API system prompt + templates for blog/email image generation | Phase 4 (Image Generation) |
| `compliance-rules.json` | Hard flags, soft flags, AI slop phrases, brand rules for client-side compliance scanning | Phase 3 (auto-scan after generation), Phase 5 (live scan during edit) |
| `topic-brief-schema.json` | JSON schema for validating CSV/JSON topic brief imports | Phase 2 (Topic Import) |
| `topic-brief-template.csv` | Example CSV with headers and 5 sample rows — use as reference and test data | Phase 2 (Topic Import) |
| `segments.json` | Segment IDs, colors, display names, Reddit sources, Google seed queries, Klaviyo IDs, send schedules | Used everywhere — sidebar, research, image prompts, campaign creation, schedule preview |
| `email-template.html` | Klaviyo campaign email HTML with dynamic slots (hero image, body, CTA, blog URL) | Phase 6 (Publish — injected before Klaviyo MCP call) |
| `notebooklm-setup-guide.md` | Standalone instructions for Benoit to set up and maintain NotebookLM notebooks | NOT used by the app — this is a human-readable guide |

## How Claude Code Should Use These

1. **Import JSON configs** as module constants. Don't hardcode values that exist in these files.
2. **The compliance scanner** should be implemented as a utility function that takes a package object and the `compliance-rules.json` config, returning an array of flag objects.
3. **The email template** should be loaded as a string, with `{{SLOT}}` markers replaced by the package's content before the Klaviyo MCP call.
4. **Segment colors, names, and IDs** should come from `segments.json`, not from hardcoded arrays.
5. **System prompts** are stored as JSON with a `system_prompt` field (string) and a `user_prompt_template` field (string with `{{variable}}` placeholders). The app should replace placeholders at call time.

## Fields to Fill After Setup

Several config fields are marked `FILL_AFTER_SETUP`:
- `segments.json` → `klaviyo_segment_id` for each segment (get from Klaviyo after creating segments)
- `segments.json` → `brand_constants.shopify_blog_handle` (the Shopify blog collection handle)

These should be filled in during the Setup Phase (PRD tasks 0.4 and 0.5).
