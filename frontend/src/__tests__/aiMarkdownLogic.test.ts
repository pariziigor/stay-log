import { describe, it, expect } from 'vitest';

describe('AIMarkdown Text Processing Rules', () => {
  const parseInlineElements = (text: string) => {
    // Splits on bold **text** or inline `code`
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

  it('correctly extracts inline code spans', () => {
    const input = 'Use a chave `min_quantity` para configurar o estoque.';
    const parsed = parseInlineElements(input);

    expect(parsed).toEqual([
      { type: 'text', content: 'Use a chave ' },
      { type: 'code', content: 'min_quantity' },
      { type: 'text', content: ' para configurar o estoque.' },
    ]);
  });

  it('correctly extracts bold markdown spans', () => {
    const input = 'A taxa de ocupação foi de **85%** no período.';
    const parsed = parseInlineElements(input);

    expect(parsed).toEqual([
      { type: 'text', content: 'A taxa de ocupação foi de ' },
      { type: 'bold', content: '85%' },
      { type: 'text', content: ' no período.' },
    ]);
  });

  it('correctly classifies markdown lines by type', () => {
    const classifyLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return 'empty';
      if (trimmed.startsWith('### ')) return 'h3';
      if (trimmed.startsWith('## ')) return 'h2';
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) return 'bullet_list';
      if (/^\d+\.\s+/.test(trimmed)) return 'numbered_list';
      if (trimmed.startsWith('> ')) return 'blockquote';
      return 'paragraph';
    };

    expect(classifyLine('### Taxa de Ocupação')).toBe('h3');
    expect(classifyLine('## Relatório')).toBe('h2');
    expect(classifyLine('- Item 1')).toBe('bullet_list');
    expect(classifyLine('* Item 2')).toBe('bullet_list');
    expect(classifyLine('1. Passo um')).toBe('numbered_list');
    expect(classifyLine('2. Passo dois')).toBe('numbered_list');
    expect(classifyLine('> Importante: avisar hóspede')).toBe('blockquote');
    expect(classifyLine('Texto normal descritivo.')).toBe('paragraph');
    expect(classifyLine('   ')).toBe('empty');
  });
});

