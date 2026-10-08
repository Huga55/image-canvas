import assert from 'node:assert/strict'
import { test } from 'node:test'
import { autoGrid, averagePhotoRatio, chooseAspect, exportSize, resolveGrid } from '../src/renderer/src/lib/layout.ts'

test('export size follows the long side and keeps the ratio', () => {
  assert.deepEqual(exportSize(16 / 9), { width: 2400, height: 1350 })
  assert.deepEqual(exportSize(16 / 9, 1920), { width: 1920, height: 1080 })
  assert.deepEqual(exportSize(4 / 3), { width: 2400, height: 1800 })
  assert.deepEqual(exportSize(1), { width: 2400, height: 2400 })
  assert.deepEqual(exportSize(3 / 4), { width: 1800, height: 2400 })
  assert.deepEqual(exportSize(9 / 16, 1350), { width: 759, height: 1350 })
})

test('auto grid fits every photo and keeps a reasonable cell shape', () => {
  const cases = [
    { count: 2, canvas: 16 / 9, photo: 1.5, cols: 2, rows: 1 },
    { count: 2, canvas: 9 / 16, photo: 1.5, cols: 1, rows: 2 },
    { count: 4, canvas: 1, photo: 1.5, cols: 2, rows: 2 },
    { count: 6, canvas: 16 / 9, photo: 1.5, cols: 3, rows: 2 }
  ]

  for (const item of cases) {
    const grid = autoGrid(item.count, item.canvas, item.photo)
    assert.deepEqual(grid, { cols: item.cols, rows: item.rows })
    assert.ok(grid.cols * grid.rows >= item.count)
  }
})

test('manual grid keeps both axes and still fits every photo', () => {
  assert.deepEqual(resolveGrid(10, 16 / 9, 'manual', 3, 2, 1.5), { cols: 3, rows: 4 })
  assert.deepEqual(resolveGrid(4, 1, 'manual', 2, 3, 1.5), { cols: 2, rows: 3 })
  assert.deepEqual(resolveGrid(1, 1, 'manual', 4, 4, 1.5), { cols: 1, rows: 1 })
  assert.deepEqual(resolveGrid(0, 1, 'auto', 3, 3, 1.5), { cols: 1, rows: 1 })
})

test('auto aspect matches one photo and a square set', () => {
  const grid = { gridMode: 'auto' as const, columns: 3, rows: 2, fit: 'cover' as const }
  assert.equal(chooseAspect([{ width: 1600, height: 900 }], grid).id, '16:9')
  assert.equal(chooseAspect([{ width: 900, height: 1200 }], grid).id, '3:4')
  assert.equal(chooseAspect([{ width: 900, height: 1600 }], grid).id, '9:16')
  assert.equal(
    chooseAspect(
      [
        { width: 1000, height: 1000 },
        { width: 1000, height: 1000 },
        { width: 1000, height: 1000 },
        { width: 1000, height: 1000 }
      ],
      grid
    ).id,
    '1:1'
  )
})

test('showing photos whole can pick a different ratio than filling the cell', () => {
  const photos = [
    { width: 1600, height: 900 },
    { width: 1600, height: 900 },
    { width: 1600, height: 900 }
  ]
  const base = { gridMode: 'auto' as const, columns: 3, rows: 2 }
  const cover = chooseAspect(photos, { ...base, fit: 'cover' })
  const contain = chooseAspect(photos, { ...base, fit: 'contain' })
  assert.notEqual(cover.id, contain.id)
})

test('average ratio uses the geometric mean', () => {
  const ratio = averagePhotoRatio([
    { width: 400, height: 200 },
    { width: 200, height: 400 }
  ])
  assert.ok(Math.abs(ratio - 1) < 0.001)
})
