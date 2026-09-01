import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WIDGET_VERSION } from '../widget'

/** Единственный источник версии виджета. */
function packageVersion(): string {
  const raw = readFileSync(join(__dirname, '../../package.json'), 'utf-8')
  return (JSON.parse(raw) as { version: string }).version
}

describe('version', () => {
  it('should match the version declared in package.json', () => {
    expect(WIDGET_VERSION).toBe(packageVersion())
  })

  it('should never render as an empty or undefined string', () => {
    expect(typeof WIDGET_VERSION).toBe('string')
    expect(WIDGET_VERSION.length).toBeGreaterThan(0)
    expect(WIDGET_VERSION).not.toBe('undefined')
  })

  it('should look like a version number', () => {
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})
