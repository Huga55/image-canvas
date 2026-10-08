import type { CollageApi } from '../shared/api'

declare global {
  interface Window {
    collage: CollageApi
  }
}

export {}
