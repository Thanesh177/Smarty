// A browser can have several consumers of news preferences. Give each account
// one in-flight write and keep only the latest choice queued behind it.
export function createNewsPreferenceSync() {
  const queues = new Map();

  async function flush(account, queue) {
    while (queue.next) {
      const task = queue.next;
      queue.next = null;

      let result;
      try {
        const value = await task.submit();
        result = { status: 'synced', value };
      } catch {
        result = { status: 'failed' };
      }
      task.resolve(queue.latest === task ? result : { status: 'superseded' });
    }
    queues.delete(account);
  }

  return (account, submit) => new Promise(resolve => {
    const existing = queues.get(account);
    const queue = existing || {};
    queue.next?.resolve({ status: 'superseded' });
    queue.latest = queue.next = { submit, resolve };
    if (!existing) {
      queues.set(account, queue);
      void flush(account, queue);
    }
  });
}
