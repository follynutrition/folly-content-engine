import { blogPrompt, emailPrompt } from './config';
import type { TopicBrief, ContentPackage } from './types';
import { generateId } from './utils';

interface BlogResult {
  headline: string;
  meta_title: string;
  meta_description: string;
  body_html: string;
  tags: string[];
  word_count: number;
  source_question: string;
  citations?: { title: string; journal: string; year: string; doi: string }[];
}

interface EmailResult {
  subject_line: string;
  preview_text: string;
  body_text: string;
  cta_text: string;
  subject_char_count: number;
  body_word_count: number;
}

export interface PubMedSource {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi: string;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

async function callClaude(systemPrompt: string, userPrompt: string, model: string, maxTokens: number, temperature: number): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt, model, maxTokens, temperature }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content;
}

function buildSourcesSection(sources: PubMedSource[]): string {
  if (!sources || sources.length === 0) return '';
  const formatted = sources.map(s =>
    `- "${s.title}" (${s.journal}, ${s.year}) DOI: ${s.doi}`
  ).join('\n');
  return `RESEARCH SOURCES (cite at least one naturally in the blog body):\n${formatted}`;
}

export async function generateBlog(topic: TopicBrief, sources?: PubMedSource[]): Promise<BlogResult> {
  const sourcesSection = buildSourcesSection(sources ?? []);

  const userPrompt = fillTemplate(blogPrompt.user_prompt_template, {
    headline: topic.headline,
    segment: topic.segment,
    source_question: topic.source_question,
    emotion: topic.emotion,
    folly_hook: topic.folly_hook,
    sources_section: sourcesSection,
  });

  const content = await callClaude(
    blogPrompt.system_prompt,
    userPrompt,
    blogPrompt.model,
    blogPrompt.max_tokens,
    blogPrompt.temperature,
  );

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse blog response');
  return JSON.parse(jsonMatch[0]);
}

export async function generateEmail(topic: TopicBrief, blogBody: string, blogUrl: string): Promise<EmailResult> {
  const userPrompt = fillTemplate(emailPrompt.user_prompt_template, {
    headline: topic.headline,
    segment: topic.segment,
    source_question: topic.source_question,
    emotion: topic.emotion,
    blog_url: blogUrl,
    blog_body: blogBody,
  });

  const content = await callClaude(
    emailPrompt.system_prompt,
    userPrompt,
    emailPrompt.model,
    emailPrompt.max_tokens,
    emailPrompt.temperature,
  );

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse email response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate a complete package: blog + email + images in parallel where possible.
 * Blog must come first (email needs it), but images can run alongside.
 */
export async function generatePackage(topic: TopicBrief, sources?: PubMedSource[]): Promise<ContentPackage> {
  // Generate blog first (email depends on it)
  const blog = await generateBlog(topic, sources);

  // Generate email (needs blog content to know what NOT to reveal)
  const email = await generateEmail(topic, blog.body_html, '#');

  return {
    id: generateId(),
    topicId: topic.id,
    segment: topic.segment,
    sourceQuestion: topic.source_question,
    emotion: topic.emotion,
    follyHook: topic.folly_hook,
    headline: blog.headline,
    metaTitle: blog.meta_title,
    metaDescription: blog.meta_description,
    blogBody: blog.body_html,
    blogTags: blog.tags,
    wordCount: blog.word_count,
    subjectLine: email.subject_line,
    previewText: email.preview_text,
    emailBody: email.body_text,
    ctaText: email.cta_text,
    blogImageUrl: null,
    emailImageUrl: null,
    blogImageStatus: 'pending',
    emailImageStatus: 'pending',
    status: 'pending',
    complianceFlags: [],
  };
}

export async function repromptBlog(pkg: ContentPackage, instruction: string): Promise<BlogResult> {
  const userPrompt = fillTemplate(blogPrompt.user_prompt_template, {
    headline: pkg.headline,
    segment: pkg.segment,
    source_question: pkg.sourceQuestion,
    emotion: pkg.emotion,
    folly_hook: pkg.follyHook,
    sources_section: '',
  }) + `\n\nREPROMPT INSTRUCTION: ${instruction}\n\nRewrite the blog following this instruction while keeping the same topic and compliance rules.`;

  try {
    const content = await callClaude(
      blogPrompt.system_prompt,
      userPrompt,
      blogPrompt.model,
      blogPrompt.max_tokens,
      blogPrompt.temperature,
    );

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse blog response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('repromptBlog failed:', err);
    throw err;
  }
}

export async function repromptEmail(pkg: ContentPackage, blogBody: string, instruction: string): Promise<EmailResult> {
  const userPrompt = fillTemplate(emailPrompt.user_prompt_template, {
    headline: pkg.headline,
    segment: pkg.segment,
    source_question: pkg.sourceQuestion,
    emotion: pkg.emotion,
    blog_url: '#',
    blog_body: blogBody,
  }) + `\n\nREPROMPT INSTRUCTION: ${instruction}\n\nRewrite the email following this instruction while keeping the same topic and compliance rules.`;

  try {
    const content = await callClaude(
      emailPrompt.system_prompt,
      userPrompt,
      emailPrompt.model,
      emailPrompt.max_tokens,
      emailPrompt.temperature,
    );

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse email response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('repromptEmail failed:', err);
    throw err;
  }
}

// Mock content generation for when Claude API isn't available
export function generateMockPackage(topic: TopicBrief): ContentPackage {
  const excerpts: Record<string, string> = {
    scared: "You've noticed it — the extra hair in the drain, the thinning at the temples. It's not your imagination, and you're not alone.",
    angry: "Your doctor brushed it off. 'It'll grow back,' they said. But they didn't tell you why it's happening or what you can do about it now.",
    frustrated: "You've tried the supplements, the biotin, the expensive shampoos. Nothing's changed. Here's what most people miss.",
    worried: "The changes are subtle at first. A wider part. A thinner ponytail. But you noticed, and that matters.",
    confused: "There's so much conflicting advice out there. Let me cut through the noise with what the research actually shows.",
    anxious: "The waiting is the hardest part. Not knowing if it's temporary, if it'll get worse, or if there's something you can do.",
    desperate: "When nothing seems to work, it's easy to lose hope. But the problem might not be what you're taking — it's how you're taking it.",
    panicked: "Take a breath. What you're experiencing has a name, a cause, and a path forward.",
    hopeful: "Those tiny baby hairs? They're a sign. Your body is trying to recover — it just needs the right support.",
    seeking: "You're doing the right thing by looking for answers. Here's what the latest research says.",
  };

  const excerpt = excerpts[topic.emotion] ?? excerpts.worried;
  const blogBody = `<p>${excerpt}</p><p>Most women experiencing this don't realize that their supplement delivery system matters as much as the ingredients themselves. When your body's absorption is compromised, even the best ingredients get destroyed before they reach the follicle.</p><p>A 2023 study in the Journal of Clinical Nutrition found that standard supplement capsules lose up to 98% of their active ingredients during digestion. That's not a quality problem — it's a delivery problem.</p><p>That's why I formulated Folly with dual-layer microsphere encapsulation — ${topic.folly_hook.toLowerCase()}. It's not about adding more ingredients. It's about making sure the ones that matter actually get where they need to go.</p><p>This is exactly why I built Folly with 1,675mg of clinically studied actives protected by our proprietary delivery system.</p>`;

  return {
    id: generateId(),
    topicId: topic.id,
    segment: topic.segment,
    sourceQuestion: topic.source_question,
    emotion: topic.emotion,
    follyHook: topic.folly_hook,
    headline: topic.headline,
    metaTitle: `${topic.headline} | Folly Nutrition`,
    metaDescription: `${topic.source_question} Here's what the research says about ${topic.segment === 'glp1' ? 'GLP-1' : topic.segment} hair health.`,
    blogBody,
    blogTags: [topic.segment, topic.freshness],
    wordCount: blogBody.split(/\s+/).length,
    subjectLine: topic.suggested_subject_line,
    previewText: excerpt.substring(0, 85) + '...',
    emailBody: `I hear from women every week who hit this exact wall. ${excerpt.split('.')[0]}.`,
    ctaText: 'Read what I found',
    blogImageUrl: null,
    emailImageUrl: null,
    blogImageStatus: 'pending',
    emailImageStatus: 'pending',
    status: 'pending',
    complianceFlags: [],
  };
}
