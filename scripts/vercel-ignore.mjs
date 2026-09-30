#!/usr/bin/env node
// Vercel: exit 0 skips, exit 1 builds. Unknown history always builds.
import { execFileSync } from 'node:child_process';
const base = process.env.VERCEL_GIT_PREVIOUS_SHA || 'HEAD^';
try {
  const files=execFileSync('git',['diff','--name-only','-z',base,'HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);
  const operational=file=> /^(?:mobile|supabase|docs|tests|ops|artifacts|\.github)\//.test(file) || /\.md$/i.test(file) || /^scripts\/(?:database-recovery|smoke-live|run-tests)\.mjs$/.test(file);
  const needed=files.some(file=>!operational(file));
  console.log(needed?'Web application changed; build required.':'Only non-web files changed; skipping web build.');
  process.exitCode=needed?1:0;
} catch {
  console.log('Previous deployment history unavailable; build required.');
  process.exitCode=1;
}
