import { describe, it, expect } from 'vitest';
import { createSlug } from '../../utils/slug.js';

describe('createSlug', () => {
  it('should convert text to kebab-case', () => {
    expect(createSlug('Hello World')).toBe('hello-world');
  });

  it('should handle Italian accents', () => {
    const slug = createSlug('Guida alla configurazione');
    expect(slug).toBe('guida-alla-configurazione');
  });

  it('should handle special characters', () => {
    const slug = createSlug('Test & Demo (v2.0)');
    expect(slug).toMatch(/^test/);
    expect(slug).not.toContain('&');
    expect(slug).not.toContain('(');
  });

  it('should handle empty string', () => {
    const slug = createSlug('');
    expect(slug).toBe('');
  });

  it('should produce lowercase output', () => {
    const slug = createSlug('UPPERCASE TITLE');
    expect(slug).toBe(slug.toLowerCase());
  });
});
