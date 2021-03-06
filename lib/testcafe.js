/* eslint-disable no-plusplus */

const path = require('path');

const PWD = process.cwd();

const RE_SPLIT = /[\s;,]/;
const RE_SYMBOLS = /[$`]/g;

const USE_SEQUENCE = Math.random().toString(36).substr(2, 2);

function safe(value) {
  return JSON.stringify(value.replace(/[/<>\\*|]+/g, ''));
}

function ident(test, offset, context) {
  const input = test.data.slice();

  const prefix = `00000${offset}`.substr(-3);

  const suffix = test.step.replace(/\$(\w+)/g, (_, $1) => {
    if (context.matchers[$1]) return `[${$1}]`;
    return input.shift() || $1;
  });

  return `${prefix}) ${suffix}`;
}

function encode(test, offset, context, snapshot) {
  if (typeof snapshot === 'string' || Array.isArray(snapshot)) {
    const selectors = (!Array.isArray(snapshot) ? snapshot.split(RE_SPLIT) : snapshot)
      .map(x => `__elem${USE_SEQUENCE}(${safe(x)})`);

    return `{ label: ${safe(ident(test, offset, context))}, selector: [${selectors.join(', ')}] }`;
  }

  if (typeof snapshot === 'object') {
    return JSON.stringify(snapshot);
  }

  return safe(ident(test, offset, context));
}

function relative(file, baseDir) {
  return path.relative(baseDir || PWD, file);
}

function escapeSymbols(value) {
  return value.replace(RE_SYMBOLS, '\\$&');
}

module.exports = ({
  noSnapshot, destDir, context, feature, steps, url,
}, offset = 0) => `${!noSnapshot ? `import {
  takeSnapshot as __snapshot${USE_SEQUENCE},
  getEl as __elem${USE_SEQUENCE},
} from 'bdd-tc';\n` : ''}${
  steps.map((file, nth) => `import $step${nth} from '${relative(file, destDir)}';`).join('\n')
}

// ${relative(feature.filepath)}
fixture \`${escapeSymbols(feature.title)}\`${
  (feature.options.url && `\n  .page(${JSON.stringify(feature.options.url)})`)
    || (url ? `\n  .page($step${steps.indexOf(url)}.url(${JSON.stringify(feature.options.path)}))` : '')
}${
  feature.beforeEach ? `\n  .beforeEach(async t => {
${feature.beforeEach.map(hook => `    await $step${steps.indexOf(hook.path)}.before.${hook.fn}(${
    JSON.stringify(hook.input)
  })(t);`).join('\n')}
  })` : ''
}${
  feature.afterEach ? `\n  .afterEach(async t => {
${feature.afterEach.map(hook => `    await $step${steps.indexOf(hook.path)}.after.${hook.fn}(${
    JSON.stringify(hook.input)
  })(t);`).join('\n')}
  })` : ''
};

${feature.scenarios.map(scenario => `test${
    scenario.options.url ? `\n  .page(${JSON.stringify(scenario.options.url)})` : ''
  }${
    scenario.before ? `\n  .before(async t => {
${scenario.before.map(hook => `    await $step${steps.indexOf(hook.path)}.before.${hook.fn}(${
    JSON.stringify(hook.input)
  })(t);`).join('\n')}
  })` : ''
  }(\`${escapeSymbols(scenario.title)}\`, async t => {
${scenario.tests.map(test => `  await $step${steps.indexOf(test.path)}[\`${escapeSymbols(test.step)}\`](${
    test.data.map(value => JSON.stringify(value)).join(', ')
  })(t);${scenario.options.snapshot && !noSnapshot
    ? `\n  await __snapshot${USE_SEQUENCE}(t, ${encode(test, ++offset, context, scenario.options.snapshot)});`
    : ''}`).join('\n')}
})${
  scenario.after ? `\n  .after(async t => {
${scenario.after.map(hook => `    await $step${steps.indexOf(hook.path)}.after.${hook.fn}(${
    JSON.stringify(hook.input)
  })(t);`).join('\n')}
  })` : ''
};`).join('\n')}
`;
