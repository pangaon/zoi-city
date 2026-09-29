#!/usr/bin/env node
// Checks the requested deployment, including candidate URLs supplied via SITE.
// This is an HTTP readiness check; it does not certify authenticated workflows.
const SITE = (process.env.SITE || 'https://www.zoi.city').replace(/\/$/, '');
const paths = ['/', '/apps/', '/explore', '/tickets', '/community', '/social', '/add', '/business'];

console.log(`# HTTP readiness — SITE=${SITE}`);
const results = await Promise.all(paths.map(async path => {
  const url = SITE + path;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'zoi-smoke-check/2.0' },
      signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();
    const structural = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
    const errors = [];
    if (new URL(res.url).origin !== new URL(SITE).origin) errors.push('redirected outside requested deployment');
    if (!html.includes('/assets/zoi-theme.css')) errors.push('missing Zoi application shell');
    if (res.status !== 200) errors.push(`HTTP ${res.status}`);
    if (!(res.headers.get('content-type') || '').includes('text/html')) errors.push('not HTML');
    if ((structural.match(/<title\b/gi) || []).length !== 1) errors.push('expected one title');
    if (!/<meta[^>]+name=["']viewport["']/i.test(structural)) errors.push('missing viewport');
    if (/DEPLOYMENT_PAUSED|DEPLOYMENT_NOT_FOUND|This page could not be found/i.test(html)) errors.push('deployment/error page');
    return { path, ok: errors.length === 0, errors };
  } catch (error) {
    return { path, ok: false, errors: [error.message] };
  }
}));
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.path}${result.errors.length ? ': ' + result.errors.join('; ') : ''}`);
}
const failed = results.filter(result => !result.ok).length;
console.log(`\n# ${results.length - failed}/${results.length} HTTP readiness checks passed`);
process.exitCode = failed ? 1 : 0;
