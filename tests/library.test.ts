import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createLibrary } from '../src/main/library.ts'

const first = '11111111-1111-4111-8111-111111111111'
const second = '22222222-2222-4222-8222-222222222222'

test('library keeps photos, order, settings and file bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collage-library-'))
  try {
    const library = createLibrary(directory)
    const source = join(directory, 'source.jpg')
    await writeFile(source, Buffer.from('photo-one'))

    await library.addFromPath({
      id: first,
      name: ' one.jpg ',
      width: 10,
      height: 20,
      sourcePath: source
    })
    await library.addFromBytes({
      id: second,
      name: 'Из буфера.png',
      width: 30,
      height: 40,
      base64: Buffer.from('photo-two').toString('base64'),
      extension: 'png'
    })
    await library.reorder([second, first])
    await library.saveSettings({ aspectId: '1:1', gap: 4 })

    const loaded = await library.load()
    assert.deepEqual(
      loaded.photos.map((photo) => photo.id),
      [second, first]
    )
    assert.equal(loaded.photos[1]?.name, 'one.jpg')
    assert.deepEqual(loaded.settings, { aspectId: '1:1', gap: 4 })

    const response = await library.respond(new Request(`collage://photo/${first}`))
    assert.equal(response.status, 200)
    assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'photo-one')
    assert.equal(await readFile(join(directory, 'files', `${second}.png`), 'utf8'), 'photo-two')

    await library.remove(first)
    const afterRemove = await library.load()
    assert.deepEqual(afterRemove.photos.map((photo) => photo.id), [second])
    assert.equal((await library.respond(new Request(`collage://photo/${first}`))).status, 404)

    await library.clear()
    const empty = await library.load()
    assert.deepEqual(empty.photos, [])
    assert.deepEqual(empty.settings, { aspectId: '1:1', gap: 4 })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('library rejects a path outside its folder', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'collage-library-'))
  try {
    const library = createLibrary(directory)
    const response = await library.respond(new Request('collage://photo/../../secret'))
    assert.equal(response.status, 404)
    await assert.rejects(() =>
      library.addFromPath({
        id: '../secret',
        name: 'bad',
        width: 1,
        height: 1,
        sourcePath: join(directory, 'missing.png')
      })
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
