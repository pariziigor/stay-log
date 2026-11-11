import React from 'react';

interface AIMarkdownProps {
  content: string;
}

export interface InlineSegment {
  type: 'text' | 'code' | 'bold';
  content: string;
}

export type MarkdownLineType =
  | 'empty'
  | 'h3'
  | 'h2'
  | 'bullet_list'
  | 'numbered_list'
  | 'blockquote'
  | 'paragraph';

export const parseInlineSegments = (text: string): InlineSegment[] => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return { type: 'code', content: part.slice(1, -1) };
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return { type: 'bold', content: part.slice(2, -2) };
    }
    return { type: 'text', content: part };
  });
};

export const classifyMarkdownLine = (line: string): MarkdownLineType => {
  const trimmed = line.trim();
  if (!trimmed) return 'empty';
  if (trimmed.startsWith('### ')) return 'h3';
  if (trimmed.startsWith('## ')) return 'h2';
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return 'bullet_list';
  if (/^\d+\.\s+/.test(trimmed)) return 'numbered_list';
  if (trimmed.startsWith('> ')) return 'blockquote';
  return 'paragraph';
};

export const AIMarkdown: React.FC<AIMarkdownProps> = ({ content }) => {
  const lines = content.split('\n');

  const renderFormattedText = (text: string) => {
    return parseInlineSegments(text).map((seg, index) => {
      if (seg.type === 'code') {
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded-md bg-slate-100 text-brand-600 font-mono text-xs font-semibold"
          >
            {seg.content}
          </code>
        );
      }
      if (seg.type === 'bold') {
        return (
          <strong key={index} className="font-bold text-slate-900">
            {seg.content}
          </strong>
        );
      }
      return <span key={index}>{seg.content}</span>;
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const lineType = classifyMarkdownLine(line);

        if (lineType === 'empty') {
          return <div key={idx} className="h-2" />;
        }

        if (lineType === 'h3') {
          return (
            <h3
              key={idx}
              className="text-base font-bold text-slate-900 pt-2 pb-1 border-b border-slate-100 flex items-center gap-2"
            >
              {renderFormattedText(trimmed.replace('### ', ''))}
            </h3>
          );
        }

        if (lineType === 'h2') {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-slate-900 pt-3 pb-1 border-b border-slate-200 flex items-center gap-2"
            >
              {renderFormattedText(trimmed.replace('## ', ''))}
            </h2>
          );
        }

        if (lineType === 'bullet_list') {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
              <div className="flex-1">{renderFormattedText(trimmed.replace(/^[-*]\s+/, ''))}</div>
            </div>
          );
        }

        if (lineType === 'numbered_list') {
          const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numberMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-xs font-bold text-brand-600 bg-brand-50 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  {numberMatch[1]}
                </span>
                <div className="flex-1">{renderFormattedText(numberMatch[2])}</div>
              </div>
            );
          }
        }

        if (lineType === 'blockquote') {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-brand-500 bg-brand-50/50 rounded-r-lg px-3 py-2 text-xs italic text-slate-700 my-2"
            >
              {renderFormattedText(trimmed.replace('> ', ''))}
            </blockquote>
          );
        }

        return (
          <p key={idx} className="text-slate-700">
            {renderFormattedText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};
