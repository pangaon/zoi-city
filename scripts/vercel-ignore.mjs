#!/usr/bin/env node
// Vercel: exit 0 skips, exit 1 builds. Unknown history always builds.
import { execFileSync } from 'node:child_process';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';
import {resolve, relative, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const operational = file => /^(?:mobile|supabase|docs|tests|ops|artifacts|research|\.github)\//.test(file) || /\.md$/i.test(file) || (file.startsWith('scripts/') && file!=='scripts/vercel-ignore.mjs');
const textSource = file => /\.(?:html?|[cm]?js|ts|css)$/i.test(file);
const git = (cwd, args) => execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','ignore'], maxBuffer:8*1024*1024}).split('\0').filter(Boolean);

// Public source may import backend helpers. Follow its literal local references
// transitively, including query-versioned imports. Never read docs/evidence or
// untracked/private files. Unknown/unreadable source makes the caller build.
export function webDependencies(cwd = process.cwd()) {
  const root = realpathSync(cwd), tracked = new Set(git(root, ['ls-files','-z']));
  const pending = [...tracked].filter(file => !operational(file) && textSource(file));
  const seen = new Set(), references = new Set();
  while (pending.length) {
    const file = pending.pop();if(seen.has(file))continue;seen.add(file);
    if(!tracked.has(file) || !textSource(file) || (operational(file) && !file.startsWith('supabase/functions/')))continue;
    const absolute = resolve(root,file), stat = lstatSync(absolute);
    if(!stat.isFile() || stat.size>8*1024*1024 || !realpathSync(absolute).startsWith(root+sep))throw Error('Uncertain web dependency');
    const source = readFileSync(absolute,'utf8');
    // A conservative superset of import/src/href references avoids executing
    // code or introducing a build-time dependency. Only tracked files are read.
    for(const match of source.matchAll(/['"`]((?:\.{1,2}\/|\/)[^'"`\r\n]*)['"`]/g)) {
      const literal = match[1].split(/[?#]/,1)[0].split('${',1)[0];
      const target = literal.startsWith('/')?resolve(root,'.'+literal):resolve(dirname(absolute),literal);
      const name = relative(root,target).split(sep).join('/');
      if(!name || name==='..' || name.startsWith('../'))continue;
      const candidates = /\.[^/]+$/.test(name)?[name]:[name,...['.js','.mjs','.ts','.json','/index.js','/index.mjs','/index.ts'].map(suffix=>name+suffix)];
      for(const candidate of candidates){references.add(candidate);if(tracked.has(candidate))pending.push(candidate);}
    }
  }
  return references;
}

export function requiresWebBuild(files, cwd = process.cwd()) {
  if(files.some(file => !operational(file)))return true;
  const backend = files.filter(file => file.startsWith('supabase/'));
  if(!backend.length)return false;
  const references = webDependencies(cwd);
  return backend.some(file => references.has(file) || [...references].some(prefix => !/\.[^/]+$/.test(prefix) && file.startsWith(prefix+'/')));
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const base = process.env.VERCEL_GIT_PREVIOUS_SHA || 'HEAD^';
    const files = git(process.cwd(), ['diff','--no-renames','--name-only','-z',base,'HEAD']);
    const needed = requiresWebBuild(files);
    console.log(needed?'Web application or shared runtime dependency changed; build required.':'Only non-web files changed; skipping web build.');
    process.exitCode = needed?1:0;
  } catch {
    console.log('Deployment history or web dependencies unavailable; build required.');
    process.exitCode = 1;
  }
}
