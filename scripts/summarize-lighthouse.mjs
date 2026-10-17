import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { arch, platform, release } from 'node:os'

const root = resolve('reports/lighthouse')
const thresholds = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const metricIds = ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time']

function median(values) {
  if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('Each page and preset must have exactly three valid runs.')
  }
  return [...values].sort((first, second) => first - second)[1]
}

const results = []
for (const preset of ['mobile', 'desktop']) {
  const directory = resolve(root, preset)
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'))
  const filenames = (await readdir(directory)).filter((filename) =>
    manifest.some((entry) => basename(entry.jsonPath) === filename),
  )
  const groups = new Map()
  for (const filename of filenames) {
    const report = JSON.parse(await readFile(resolve(directory, filename), 'utf8'))
    if (report.runtimeError) throw new Error(report.runtimeError.message)
    const pathname = new URL(report.requestedUrl).pathname
    const reports = groups.get(pathname) ?? []
    reports.push(report)
    groups.set(pathname, reports)
  }
  for (const pathname of ['/', '/nfts/nft-1']) {
    const reports = groups.get(pathname) ?? []
    const scores = Object.fromEntries(Object.keys(thresholds).map((category) => [
      category, Math.round(median(reports.map((report) => report.categories[category].score)) * 100),
    ]))
    const metrics = Object.fromEntries(metricIds.map((metric) => [
      metric, median(reports.map((report) => report.audits[metric].numericValue)),
    ]))
    results.push({
      preset, pathname, runs: reports.length, scores, metrics,
      passes: Object.entries(thresholds).every(([category, threshold]) => scores[category] >= threshold),
      environment: {
        lighthouse: reports[0].lighthouseVersion,
        browser: reports[0].environment.hostUserAgent,
        throttlingMethod: reports[0].configSettings.throttlingMethod,
        throttling: reports[0].configSettings.throttling,
        fetchTimes: reports.map((report) => report.fetchTime),
      },
    })
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  os: `${platform()} ${release()} ${arch()}`,
  lighthouseCi: '0.14.0',
  thresholds,
  passes: results.every((result) => result.passes),
  results,
}
await writeFile(resolve(root, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
const rows = results.map(({ preset, pathname, scores, metrics, passes }) =>
  `| ${preset} | ${pathname} | ${Object.values(scores).join(' | ')} | ${(metrics['largest-contentful-paint'] / 1000).toFixed(2)} | ${metrics['cumulative-layout-shift'].toFixed(3)} | ${Math.round(metrics['total-blocking-time'])} | ${passes ? 'PASS' : 'FAIL'} |`,
)
const markdown = [
  '# Lighthouse Medians', '',
  `Generated: ${summary.generatedAt}. Three cold runs per page and preset on the production build.`, '',
  `Node ${summary.node}; ${summary.os}; LHCI ${summary.lighthouseCi}.`, '',
  '| Preset | Page | Performance | Accessibility | Best Practices | SEO | LCP (s) | CLS | TBT (ms) | Gate |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows, '',
  'Thresholds: performance >= 90, accessibility >= 95, best practices >= 95, SEO >= 90.', '',
  'Each category and metric is aggregated independently by median. Browser, throttling and timestamps are recorded in summary.json. Full HTML/JSON reports are in the mobile and desktop directories.', '',
].join('\n')
await writeFile(resolve(root, 'README.md'), markdown)
console.log(markdown)
if (!summary.passes) process.exitCode = 1