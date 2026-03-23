import { imagePrompt } from './config';
import type { ContentPackage } from './types';

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function buildImagePrompt(pkg: ContentPackage, type: 'blog' | 'email'): string {
  const template = type === 'blog'
    ? imagePrompt.blog_image_prompt_template
    : imagePrompt.email_image_prompt_template;

  const vars: Record<string, string> = {
    headline: pkg.headline,
    segment: pkg.segment,
    emotion: pkg.emotion,
    subject_line: pkg.subjectLine,
  };

  const specificPrompt = fillTemplate(template, vars);
  return `${imagePrompt.base_system_prompt}\n\n${specificPrompt}`;
}

export async function generateImage(
  pkg: ContentPackage,
  type: 'blog' | 'email',
  regenerationNote?: string,
): Promise<string> {
  let prompt = buildImagePrompt(pkg, type);

  if (regenerationNote) {
    prompt += fillTemplate(imagePrompt.regeneration_prompt_suffix, {
      regeneration_note: regenerationNote,
    });
  }

  const response = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Image API error: ${response.status}`);
  }

  const data = await response.json();
  // Return as data URL for display
  return `data:${data.mimeType};base64,${data.imageData}`;
}
