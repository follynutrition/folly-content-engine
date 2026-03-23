import segmentsData from '@config/segments.json';
import complianceRulesData from '@config/compliance-rules.json';
import blogPromptData from '@config/prompt-blog-generator.json';
import emailPromptData from '@config/prompt-email-teaser-generator.json';
import imagePromptData from '@config/prompt-image-generator.json';
import topicSchemaData from '@config/topic-brief-schema.json';
import emailTemplateHtml from '@config/email-template.html?raw';
import type { Segment } from './types';

export const segmentsConfig = segmentsData;
export const segments: Segment[] = segmentsData.segments as Segment[];
export const brandConstants = segmentsData.brand_constants;
export const scheduleDefaults = segmentsData.schedule_defaults;

export const complianceRules = complianceRulesData;
export const blogPrompt = blogPromptData;
export const emailPrompt = emailPromptData;
export const imagePrompt = imagePromptData;
export const topicSchema = topicSchemaData;
export const emailTemplate = emailTemplateHtml;

export function getSegment(id: string): Segment | undefined {
  return segments.find(s => s.id === id);
}

export function getSegmentColor(id: string): string {
  return getSegment(id)?.color ?? '#E8457A';
}
