// router.js
// Tiny zero-dependency path matcher supporting :params.
// Matches method + path exactly by segment count; literal segments must equal,
// ":name" segments capture into params.

function matchRoute(routes, method, path) {
  const segments = path.split('/').filter(Boolean);
  for (let i = 0; i < routes.length; i += 1) {
    const route = routes[i];
    if (route.method !== method) continue;
    const pattern = route.path.split('/').filter(Boolean);
    if (pattern.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let j = 0; j < pattern.length; j += 1) {
      if (pattern[j].charAt(0) === ':') {
        params[pattern[j].slice(1)] = decodeURIComponent(segments[j]);
      } else if (pattern[j] !== segments[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

module.exports = { matchRoute };
