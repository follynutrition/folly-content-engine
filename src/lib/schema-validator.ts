import type { TopicBrief, EmotionTag } from './types';
import { topicSchema } from './config';
import { generateId } from './utils';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: TopicBrief[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

const REQUIRED_FIELDS = ['headline', 'source_question', 'emotion', 'folly_hook', 'suggested_subject_line', 'segment'];

const ALLOWED_EMOTIONS: EmotionTag[] = [
  'scared', 'confused', 'anxious', 'frustrated',
  'angry', 'worried', 'desperate', 'panicked',
  'hopeful', 'seeking',
];

const ALLOWED_SEGMENTS = ['glp1', 'postpartum', 'perimeno', 'pillfatigue'];
const ALLOWED_FRESHNESS = ['trending', 'evergreen', 'seasonal'];

const MAX_LENGTHS: Record<string, number> = {};

// Extract max lengths from schema
const fields = (topicSchema as { fields: Record<string, { max_length?: number }> }).fields;
for (const [key, def] of Object.entries(fields)) {
  if (def.max_length) {
    MAX_LENGTHS[key] = def.max_length;
  }
}

export function validateTopics(rows: Record<string, string>[]): ValidationResult {
  const valid: TopicBrief[] = [];
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed, row 1 is headers
    let hasError = false;

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || row[field].trim() === '') {
        errors.push({ row: rowNum, field, message: `Missing required field '${field}'` });
        hasError = true;
      }
    }

    if (hasError) continue;

    // Validate emotion enum
    const emotion = row.emotion.trim().toLowerCase();
    if (!ALLOWED_EMOTIONS.includes(emotion as EmotionTag)) {
      errors.push({
        row: rowNum,
        field: 'emotion',
        message: `Invalid emotion '${row.emotion}'. Allowed: ${ALLOWED_EMOTIONS.join(', ')}`,
      });
      continue;
    }

    // Validate segment enum
    const segment = row.segment.trim().toLowerCase();
    if (!ALLOWED_SEGMENTS.includes(segment)) {
      errors.push({
        row: rowNum,
        field: 'segment',
        message: `Invalid segment '${row.segment}'. Allowed: ${ALLOWED_SEGMENTS.join(', ')}`,
      });
      continue;
    }

    // Validate freshness enum if provided
    const freshness = row.freshness?.trim().toLowerCase() || 'evergreen';
    if (!ALLOWED_FRESHNESS.includes(freshness)) {
      errors.push({
        row: rowNum,
        field: 'freshness',
        message: `Invalid freshness '${row.freshness}'. Allowed: ${ALLOWED_FRESHNESS.join(', ')}`,
      });
      continue;
    }

    // Check max lengths (warnings only)
    for (const [field, maxLen] of Object.entries(MAX_LENGTHS)) {
      const val = row[field];
      if (val && val.length > maxLen) {
        warnings.push({
          row: rowNum,
          field,
          message: `'${field}' exceeds recommended max length (${val.length}/${maxLen} chars)`,
        });
      }
    }

    valid.push({
      id: generateId(),
      headline: row.headline.trim(),
      source_question: row.source_question.trim(),
      emotion: emotion as EmotionTag,
      folly_hook: row.folly_hook.trim(),
      suggested_subject_line: row.suggested_subject_line.trim(),
      segment,
      freshness: freshness as 'trending' | 'evergreen' | 'seasonal',
      selected: true,
    });
  }

  return { valid, errors, warnings };
}
