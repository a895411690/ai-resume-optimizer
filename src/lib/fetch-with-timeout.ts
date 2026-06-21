export const DEFAULT_AI_FETCH_TIMEOUT_MS = 60_000;
export const DEFAULT_PAYMENT_FETCH_TIMEOUT_MS = 15_000;

function combineAbortSignals(timeoutSignal: AbortSignal, externalSignal?: AbortSignal | null) {
  if (!externalSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, externalSignal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (timeoutSignal.aborted || externalSignal.aborted) {
    abort();
  } else {
    timeoutSignal.addEventListener("abort", abort, { once: true });
    externalSignal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_AI_FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: combineAbortSignals(controller.signal, init.signal),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && controller.signal.aborted) {
      throw new Error("外部服务响应超时，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
