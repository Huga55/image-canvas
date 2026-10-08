import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { APP_VERSION } from '../src/renderer/src/changelog.ts'

test('changelog version matches the package', () => {
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  assert.equal(APP_VERSION, version)
})
