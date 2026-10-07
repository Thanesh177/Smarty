// One outstanding decision at a time. Navigation and account changes cancel it;
// a delayed dialog must never authorize an action on a different screen/account.
export function createActionConfirmation() {
  let pending = null;
  const listeners = new Set();
  const emit = () => listeners.forEach(listener => listener(pending?.options || null));
  const finish = approved => {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    emit();
    resolve(approved === true);
  };
  return {
    request(options) {
      if (pending) return Promise.resolve(false);
      return new Promise(resolve => {
        pending = { resolve, options: {
          title: options?.title || 'Are you sure?',
          description: options?.description || 'Please confirm before continuing.',
          confirmLabel: options?.confirmLabel || 'Confirm',
          cancelLabel: options?.cancelLabel || 'Cancel',
          danger: options?.danger !== false,
        } };
        emit();
      });
    },
    finish,
    cancel: () => finish(false),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

// Some endpoints return a rejected action with HTTP 200. Never treat that as a
// successful deletion; callers retain their content and show their retry state.
export function assertActionAccepted(result) {
  const body = result?.data ?? result;
  if (body?.success === false) throw new Error('The action was not accepted. Please try again.');
  return result;
}
