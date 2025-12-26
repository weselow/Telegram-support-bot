import { describe, it, expect } from '@jest/globals';
import { formatMessage } from '../messages.js';

describe('formatMessage', () => {
  it('should replace single variable', () => {
    const template = 'Hello, {name}!';
    const result = formatMessage(template, { name: 'John' });
    expect(result).toBe('Hello, John!');
  });

  it('should replace multiple variables', () => {
    const template = '{greeting}, {name}! Your order #{orderId} is ready.';
    const result = formatMessage(template, {
      greeting: 'Hi',
      name: 'Alice',
      orderId: 123,
    });
    expect(result).toBe('Hi, Alice! Your order #123 is ready.');
  });

  it('should handle number values', () => {
    const template = 'You have {count} messages';
    const result = formatMessage(template, { count: 5 });
    expect(result).toBe('You have 5 messages');
  });

  it('should keep placeholder if variable not provided', () => {
    const template = 'Hello, {name}! Status: {status}';
    const result = formatMessage(template, { name: 'Bob' });
    expect(result).toBe('Hello, Bob! Status: {status}');
  });

  it('should handle empty vars object', () => {
    const template = 'Static message with {placeholder}';
    const result = formatMessage(template, {});
    expect(result).toBe('Static message with {placeholder}');
  });

  it('should handle template without placeholders', () => {
    const template = 'No placeholders here';
    const result = formatMessage(template, { unused: 'value' });
    expect(result).toBe('No placeholders here');
  });

  it('should handle zero value', () => {
    const template = 'Items: {count}';
    const result = formatMessage(template, { count: 0 });
    expect(result).toBe('Items: 0');
  });

  it('should handle empty string value', () => {
    const template = 'Name: {name}';
    const result = formatMessage(template, { name: '' });
    expect(result).toBe('Name: ');
  });

  it('should replace same placeholder multiple times', () => {
    const template = '{name} met {name} and said hello to {name}';
    const result = formatMessage(template, { name: 'Alice' });
    expect(result).toBe('Alice met Alice and said hello to Alice');
  });
});
