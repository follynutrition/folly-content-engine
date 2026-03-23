import { useState, useRef, useCallback } from 'react';
import { UploadSimple, CheckCircle, WarningCircle, X } from '@phosphor-icons/react';
import { useActions } from '@/lib/store';
import { parseCSV } from '@/lib/csv-parser';
import { validateTopics } from '@/lib/schema-validator';
import type { ValidationError, ValidationWarning } from '@/lib/schema-validator';
import type { TopicBrief, EmotionTag } from '@/lib/types';
import { emotionColor, segmentColorVar, cn } from '@/lib/utils';

interface TopicImportProps {
  segmentId: string;
  onComplete: () => void;
}

type DropZoneState = 'default' | 'hover' | 'dragging' | 'success' | 'error';

export function TopicImport({ segmentId, onComplete }: TopicImportProps) {
  const actions = useActions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dropState, setDropState] = useState<DropZoneState>('default');
  const [topics, setTopics] = useState<TopicBrief[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
  const [fileName, setFileName] = useState('');

  const segColor = segmentColorVar(segmentId);
  const selectedCount = topics.filter(t => t.selected).length;

  // --- File processing ---

  const processFile = useCallback(async (file: File) => {
    setErrorMessage('');
    setErrors([]);
    setWarnings([]);
    setTopics([]);
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
      setDropState('error');
      setErrorMessage('Unsupported file type. Please upload a .csv or .json file.');
      return;
    }

    try {
      const text = await file.text();

      let rows: Record<string, string>[];
      if (ext === 'json') {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          setDropState('error');
          setErrorMessage('JSON file must contain an array of objects.');
          return;
        }
        // Coerce all values to strings for consistency
        rows = parsed.map((obj: Record<string, unknown>) => {
          const row: Record<string, string> = {};
          for (const [k, v] of Object.entries(obj)) {
            row[k] = String(v ?? '');
          }
          return row;
        });
      } else {
        rows = parseCSV(text);
      }

      if (rows.length === 0) {
        setDropState('error');
        setErrorMessage('File is empty or has no data rows.');
        return;
      }

      // Filter to current segment if segment field exists
      const segmentRows = rows.filter(r => {
        const s = r.segment?.trim().toLowerCase();
        return !s || s === segmentId;
      });

      const result = validateTopics(segmentRows.length > 0 ? segmentRows : rows);

      setTopics(result.valid.map(t => ({ ...t, segment: segmentId })));
      setErrors(result.errors);
      setWarnings(result.warnings);

      if (result.valid.length > 0) {
        setDropState('success');
        // Flash green then settle
        setTimeout(() => setDropState('default'), 1500);
      } else {
        setDropState('error');
        if (result.errors.length === 0) {
          setErrorMessage('No valid rows found in the file.');
        }
      }
    } catch (err) {
      setDropState('error');
      setErrorMessage(err instanceof SyntaxError ? 'Invalid JSON format.' : 'Failed to read file.');
    }
  }, [segmentId]);

  // --- Drag and drop handlers ---

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropState('dragging');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropState('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropState('default');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  }, [processFile]);

  // --- Topic editing ---

  const toggleSelected = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const updateField = (id: string, field: keyof TopicBrief, value: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleComplete = () => {
    const selected = topics.filter(t => t.selected);
    actions.setTopics(segmentId, selected);
    actions.setSegmentPhase(segmentId, 2);
    onComplete();
  };

  // --- Drop zone styles ---

  const dropZoneStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      height: 120,
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 8,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    };

    switch (dropState) {
      case 'dragging':
        return {
          ...base,
          border: '2px solid var(--color-primary-500)',
          backgroundColor: 'color-mix(in srgb, var(--color-primary-500) 10%, transparent)',
        };
      case 'success':
        return {
          ...base,
          border: '2px solid var(--color-success)',
          backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
        };
      case 'error':
        return {
          ...base,
          border: '2px solid var(--color-error)',
          backgroundColor: 'transparent',
        };
      case 'hover':
        return {
          ...base,
          border: '2px dashed var(--color-primary-500)',
          backgroundColor: 'color-mix(in srgb, var(--color-primary-500) 5%, transparent)',
        };
      default:
        return {
          ...base,
          border: '2px dashed var(--color-neutral-600)',
          backgroundColor: 'transparent',
        };
    }
  };

  return (
    <div className="max-w-[700px] mx-auto py-10 animate-in">
      <h2 className="font-serif text-2xl mb-1">Import Topics</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Upload a CSV or JSON file with topic briefs for this segment.
      </p>

      {/* Drop zone */}
      <div
        style={dropZoneStyle()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => { if (dropState === 'default') setDropState('hover'); }}
        onMouseLeave={() => { if (dropState === 'hover') setDropState('default'); }}
        onClick={() => fileInputRef.current?.click()}
      >
        {dropState === 'success' ? (
          <CheckCircle size={28} weight="fill" style={{ color: 'var(--color-success)' }} />
        ) : dropState === 'error' ? (
          <WarningCircle size={28} weight="fill" style={{ color: 'var(--color-error)' }} />
        ) : (
          <UploadSimple size={28} weight="bold" style={{ color: dropState === 'dragging' || dropState === 'hover' ? 'var(--color-primary-500)' : 'var(--color-neutral-500)' }} />
        )}
        <span className={cn(
          'text-sm',
          dropState === 'success' && 'text-success',
          dropState === 'error' && 'text-error',
          dropState !== 'success' && dropState !== 'error' && 'text-neutral-500',
        )}>
          {dropState === 'success'
            ? `${topics.length} topics imported from ${fileName}`
            : dropState === 'error'
              ? 'Upload failed — see errors below'
              : 'Drop a .csv or .json file here, or click to browse'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-lg text-sm text-error" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}>
          {errorMessage}
        </div>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-error">
              {errors.length} validation error{errors.length !== 1 ? 's' : ''}
            </h3>
            <button
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              onClick={() => setErrors([])}
            >
              Dismiss
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {errors.slice(0, 10).map((err, i) => (
              <div key={i} className="text-xs font-mono text-neutral-400 py-1 px-3 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 6%, transparent)' }}>
                Row {err.row}: {err.message}
              </div>
            ))}
            {errors.length > 10 && (
              <p className="text-xs text-neutral-500 mt-1">
                ...and {errors.length - 10} more errors. Fix your file and re-import.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-semibold text-warning mb-1">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </h3>
          <div className="flex flex-col gap-1">
            {warnings.slice(0, 5).map((w, i) => (
              <div key={i} className="text-xs font-mono text-neutral-500 py-1 px-3 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 6%, transparent)' }}>
                Row {w.row}: {w.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic cards */}
      {topics.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-300">
              {topics.length} topic{topics.length !== 1 ? 's' : ''} ready
            </h3>
            <span className="text-xs text-neutral-500">
              {selectedCount} selected
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {topics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                segColor={segColor}
                isEditing={editingField?.id === topic.id ? editingField.field : null}
                onToggle={() => toggleSelected(topic.id)}
                onEdit={(field) => setEditingField({ id: topic.id, field })}
                onEditDone={() => setEditingField(null)}
                onUpdateField={(field, value) => updateField(topic.id, field, value)}
              />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 flex justify-end">
            <button
              disabled={selectedCount < 1}
              onClick={handleComplete}
              className={cn(
                'text-white text-sm font-semibold px-6 py-3 rounded-xl border-none cursor-pointer transition-all duration-150',
                selectedCount < 1 && 'opacity-40 cursor-not-allowed',
              )}
              style={{
                backgroundColor: selectedCount >= 1 ? 'var(--color-primary-500)' : 'var(--color-neutral-700)',
              }}
              onMouseEnter={(e) => { if (selectedCount >= 1) (e.target as HTMLElement).style.filter = 'brightness(1.1)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.filter = 'none'; }}
            >
              Generate Content for {selectedCount} Topic{selectedCount !== 1 ? 's' : ''} &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Topic Card ---

interface TopicCardProps {
  topic: TopicBrief;
  segColor: string;
  isEditing: string | null;
  onToggle: () => void;
  onEdit: (field: string) => void;
  onEditDone: () => void;
  onUpdateField: (field: keyof TopicBrief, value: string) => void;
}

function TopicCard({ topic, segColor, isEditing, onToggle, onEdit, onEditDone, onUpdateField }: TopicCardProps) {
  const subjectLen = topic.suggested_subject_line.length;
  const subjectOver = subjectLen > 50;

  return (
    <div
      className="bg-neutral-800 rounded-lg border border-neutral-700 p-4 transition-[border-color] duration-150 hover:border-neutral-600"
      style={{
        borderLeftWidth: topic.selected ? 3 : 1,
        borderLeftColor: topic.selected ? segColor : 'var(--color-neutral-700)',
        backgroundColor: topic.selected
          ? `color-mix(in srgb, ${segColor} 8%, var(--color-neutral-800))`
          : undefined,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors duration-150"
          style={{
            borderColor: topic.selected ? segColor : 'var(--color-neutral-600)',
            backgroundColor: topic.selected ? segColor : 'transparent',
          }}
        >
          {topic.selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Headline */}
          <EditableField
            value={topic.headline}
            isEditing={isEditing === 'headline'}
            onStartEdit={() => onEdit('headline')}
            onDone={onEditDone}
            onChange={(v) => onUpdateField('headline', v)}
            className="font-serif text-base text-neutral-50 leading-snug"
          />

          {/* Source question */}
          <EditableField
            value={topic.source_question}
            isEditing={isEditing === 'source_question'}
            onStartEdit={() => onEdit('source_question')}
            onDone={onEditDone}
            onChange={(v) => onUpdateField('source_question', v)}
            className="text-sm text-neutral-400 italic mt-1"
            prefix='Answering: "'
            suffix='"'
          />

          {/* Emotion + Freshness tags */}
          <div className="flex items-center gap-2 mt-2">
            <EmotionBadge emotion={topic.emotion} />
            {topic.freshness !== 'evergreen' && (
              <span className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full bg-neutral-700 text-neutral-400">
                {topic.freshness}
              </span>
            )}
          </div>

          {/* Folly hook */}
          <div className="mt-2.5">
            <span className="text-[10px] font-mono tracking-wide text-neutral-600 uppercase">Hook</span>
            <EditableField
              value={topic.folly_hook}
              isEditing={isEditing === 'folly_hook'}
              onStartEdit={() => onEdit('folly_hook')}
              onDone={onEditDone}
              onChange={(v) => onUpdateField('folly_hook', v)}
              className="text-sm text-neutral-300 mt-0.5"
            />
          </div>

          {/* Subject line */}
          <div className="mt-2.5">
            <span className="text-[10px] font-mono tracking-wide text-neutral-600 uppercase">Subject line</span>
            <div className="flex items-center gap-2 mt-0.5">
              <EditableField
                value={topic.suggested_subject_line}
                isEditing={isEditing === 'suggested_subject_line'}
                onStartEdit={() => onEdit('suggested_subject_line')}
                onDone={onEditDone}
                onChange={(v) => onUpdateField('suggested_subject_line', v)}
                className="text-sm text-neutral-300 flex-1"
              />
              <span
                className="text-[10px] font-mono flex-shrink-0"
                style={{ color: subjectOver ? 'var(--color-warning)' : 'var(--color-neutral-600)' }}
              >
                {subjectLen}/50
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Editable Field ---

interface EditableFieldProps {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onDone: () => void;
  onChange: (value: string) => void;
  className?: string;
  prefix?: string;
  suffix?: string;
}

function EditableField({ value, isEditing, onStartEdit, onDone, onChange, className, prefix, suffix }: EditableFieldProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className={className}>{prefix}</span>}
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onDone}
          onKeyDown={(e) => { if (e.key === 'Enter') onDone(); if (e.key === 'Escape') onDone(); }}
          className="bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm text-neutral-50 outline-none focus:border-primary-500 w-full font-sans"
        />
        {suffix && <span className={className}>{suffix}</span>}
        <button onClick={onDone} className="text-neutral-500 hover:text-neutral-300 flex-shrink-0 cursor-pointer bg-transparent border-none p-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onStartEdit}
      className={cn(className, 'cursor-text rounded px-1 -mx-1 transition-colors duration-100 hover:bg-neutral-700/50')}
      title="Click to edit"
    >
      {prefix}{value}{suffix}
    </div>
  );
}

// --- Emotion Badge ---

function EmotionBadge({ emotion }: { emotion: EmotionTag }) {
  const color = emotionColor(emotion);
  return (
    <span
      className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {emotion}
    </span>
  );
}
