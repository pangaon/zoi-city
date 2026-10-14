const SKIPPED = Symbol('contract skipped');
export const skip = reason => ({status: SKIPPED, reason});
export async function runChecks(tests, {log = console.log} = {}) {
  let passed = 0, failed = 0, skipped = 0;
  log(`1..${tests.length}`);
  for (let i = 0; i < tests.length; i++) {
    const {name, fn} = tests[i];
    try {
      const result = await fn();
      if (result?.status === SKIPPED) {
        skipped++;
        log(`ok ${i + 1} - ${name} # SKIP ${result.reason}`);
      } else {
        passed++;
        log(`ok ${i + 1} - ${name}`);
      }
    } catch (error) {
      failed++;
      log(`not ok ${i + 1} - ${name}`);
      log(`# ${String(error?.message || error).replace(/\n/g, '\n# ')}`);
    }
  }
  const counts = {planned: tests.length, executed: passed + failed, passed, failed, skipped};
  log(`# ${passed}/${counts.executed} executed checks passed; ${skipped} skipped; ${failed} failed; ${tests.length} planned`);
  return counts;
}
