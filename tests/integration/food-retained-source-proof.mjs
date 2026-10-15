// Explicit forensic check: requires the retained official source bytes locally.
// Missing/mismatched evidence fails; portable unit discovery uses synthetic HTML.
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['--test',new URL('../unit/food-source-branch-independent.test.mjs',import.meta.url).pathname],{env:{...process.env,ZOI_FOOD_RETAINED_SOURCE_PROOF:'1'},stdio:'inherit'});
