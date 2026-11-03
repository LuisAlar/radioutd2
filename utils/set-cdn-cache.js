// Lets Vercel's CDN serve one cached response to every listener for `seconds`,
// so the function (and Fast Origin Transfer) runs about once per window instead
// of once per poll per open tab. Only call this on successful responses.
// https://vercel.com/docs/edge-network/caching
export default function setCdnCache (res, seconds) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}
