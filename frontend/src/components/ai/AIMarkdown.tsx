import React from 'react';

interface AIMarkdownProps {
  content: string;
}

export const AIMarkdown: React.FC<AIMarkdownProps> = ({ content }) => {
  // Processamento linha a linha para renderização estruturada e acessível
  const lines = content.split('\n');

  const renderFormattedText = (text: string) => {
    // Substitui `código`
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-brand-600 font-mono text-xs font-semibold"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // H3: ### Título
        if (trimmed.startsWith('### ')) {
          return (
            <h3
              key={idx}
              className="text-base font-bold text-slate-900 pt-2 pb-1 border-b border-slate-100 flex items-center gap-2"
            >
              {renderFormattedText(trimmed.replace('### ', ''))}
            </h3>
          );
        }

        // H2: ## Título
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-slate-900 pt-3 pb-1 border-b border-slate-200 flex items-center gap-2"
            >
              {renderFormattedText(trimmed.replace('## ', ''))}
            </h2>
          );
        }

        // Bullet lists: - ou *
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
              <div className="flex-1">{renderFormattedText(trimmed.replace(/^[-*]\s+/, ''))}</div>
            </div>
          );
        }

        // Numbered lists: 1. , 2.
        if (/^\d+\.\s+/.test(trimmed)) {
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

        // Blockquote: >
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-l-4 border-brand-500 bg-brand-50/50 rounded-r-lg px-3 py-2 text-xs italic text-slate-700 my-2"
            >
              {renderFormattedText(trimmed.replace('> ', ''))}
            </blockquote>
          );
        }

        // Parágrafo padrão
        return (
          <p key={idx} className="text-slate-700">
            {renderFormattedText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};
