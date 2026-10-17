/** Mesma medição de `lighthouserc.cjs`, com o preset de desktop (viewport e throttling de desktop). */
const base = require('./lighthouserc.cjs')

module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      settings: {
        ...base.ci.collect.settings,
        preset: 'desktop',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse/desktop',
    },
  },
}
