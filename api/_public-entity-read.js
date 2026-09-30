// Only the public, read-only home lookup is retried. Never reuse this for writes.
export async function readEntityWithRecovery(read, {wait = ms => new Promise(resolve => setTimeout(resolve, ms)), report = value => console.warn(JSON.stringify(value))} = {}) {
  try { return await read(); }
  catch (error) {
    if (error?.transientPublicRead !== true) throw error;
    report({event:'public_home_read_retry', reason:error.publicReadReason || 'upstream_unavailable'});
    await wait(100);
    return read();
  }
}
