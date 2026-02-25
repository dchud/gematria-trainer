var CACHE_NAME = "{{ cache_version }}";
var PRECACHE_URLS = [
{%- for url in asset_manifest %}
    "{{ url }}"{{ "," if not loop.last }}
{%- endfor %}
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(PRECACHE_URLS);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (names) {
            return Promise.all(
                names.filter(function (name) {
                    return name !== CACHE_NAME;
                }).map(function (name) {
                    return caches.delete(name);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", function (event) {
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            var fetched = fetch(event.request).then(function (response) {
                if (response && response.ok) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function () {
                // Network unavailable; cached response (if any) is already returned
            });
            return cached || fetched;
        })
    );
});
