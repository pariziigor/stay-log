import { describe, it, expect } from 'vitest';
import {
  classifyMarkdownLine,
  parseInlineSegments,
} from '../components/ai/AIMarkdown';

describe('AIMarkdown Real Component Parser & Line Classifier', () => {
  it('correctly extracts inline code spans', () => {
    const input = 'Use a chave `min_quantity` para configurar o estoque.';
    const parsed = parseInlineSegments(input);

    expect(parsed).toEqual([
      { type: 'text', content: 'Use a chave ' },
      { type: 'code', content: 'min_quantity' },
      { type: 'text', content: ' para configurar o estoque.' },
    ]);
  });

  it('correctly extracts bold markdown spans', () => {
    const input = 'A taxa de ocupação foi de **85%** no período.';
    const parsed = parseInlineSegments(input);

    expect(parsed).toEqual([
      { type: 'text', content: 'A taxa de ocupação foi de ' },
      { type: 'bold', content: '85%' },
      { type: 'text', content: ' no período.' },
    ]);
  });

  it('correctly classifies markdown lines by type', () => {
    expect(classifyMarkdownLine('### Taxa de Ocupação')).toBe('h3');
    expect(classifyMarkdownLine('## Relatório')).toBe('h2');
    expect(classifyMarkdownLine('- Item 1')).toBe('bullet_list');
    expect(classifyMarkdownLine('* Item 2')).toBe('bullet_list');
    expect(classifyMarkdownLine('1. Passo um')).toBe('numbered_list');
    expect(classifyMarkdownLine('2. Passo dois')).toBe('numbered_list');
    expect(classifyMarkdownLine('> Importante: avisar hóspede')).toBe('blockquote');
    expect(classifyMarkdownLine('Texto normal descritivo.')).toBe('paragraph');
    expect(classifyMarkdownLine('   ')).toBe('empty');
  });
});
