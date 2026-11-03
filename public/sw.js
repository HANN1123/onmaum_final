// 온마음 Service Worker
// - 앱 문서(HTML)와 /_next/ 빌드 자산: network-first (최신 우선, 오프라인일 때만 캐시 폴백)
//   → 배포/재시작 후에도 항상 최신 페이지를 받음 (cache-first로 인한 stale /stats 문제 해결)
// - 모델·아이콘·manifest 등 불변 자산: cache-first (오프라인 지원)
// v3: 화면 이동 데이터(RSC) 응답이 캐시에 남아 화면 이동이 멈추던 문제 수정. 이름을 올려 옛 캐시를 지운다.
const CACHE_NAME = 'onmaum-v3'

// 오프라인에 필요한 "불변" 자산만 precache. 앱 HTML(/, /stats 등)은 network-first라 제외.
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  '/models/ssd_mobilenetv1_model-weights_manifest.json',
  '/models/ssd_mobilenetv1_model-shard1',
  '/models/ssd_mobilenetv1_model-shard2',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model-shard1',
  '/models/face_expression_model-weights_manifest.json',
  '/models/face_expression_model-shard1',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.error('[SW] precache 실패:', err)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

function networkFirst(request, isDocument) {
  return fetch(request)
    .then((response) => {
      if (response.ok && response.type !== 'opaque') {
        const clone = response.clone()
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, clone))
          .catch(() => {})
      }
      return response
    })
    .catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached
        if (isDocument) return caches.match('/')
        return new Response('', { status: 504 })
      }),
    )
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached
    return fetch(request).then((response) => {
      if (response.ok && response.type !== 'opaque') {
        const clone = response.clone()
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, clone))
          .catch(() => {})
      }
      return response
    })
  })
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  // Next.js HMR / dev 리소스는 SW가 가로채지 않음 (개발 충돌 방지)
  if (url.pathname.startsWith('/_next/webpack-hmr')) return
  if (url.pathname.startsWith('/_next/static/development')) return
  // 앱 라우터의 화면 이동 데이터(RSC)는 가로채지 않음.
  // 주소가 /demo/report?_rsc=... 처럼 일반 경로라 아래 cache-first 로 떨어지면, 처음 받은 응답이 영구히 재사용되어
  // 코드가 바뀐 뒤(재배포·개발 서버 재시작) 없는 청크를 가리키게 되고 화면 이동이 멈춘다.
  if (url.searchParams.has('_rsc') || event.request.headers.get('RSC') === '1') return

  const isDocument =
    event.request.mode === 'navigate' || event.request.destination === 'document'
  // 빌드마다 바뀌는 자산(/_next/) + 앱 문서는 최신 우선
  const isBuildAsset = url.pathname.startsWith('/_next/')

  if (isDocument || isBuildAsset) {
    event.respondWith(networkFirst(event.request, isDocument))
    return
  }

  // 그 외(모델/아이콘/manifest 등 불변 자산): 캐시 우선
  event.respondWith(cacheFirst(event.request))
})
