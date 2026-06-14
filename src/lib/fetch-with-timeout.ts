export const DEFAULT_AI_FETCH_TIMEOUT_MS = 60_000;
export const DEFAULT_PAYMENT_FETCH_TIMEOUT_MS = 15_000;

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
      signal: init.signal || controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("外部服务响应超时，请稍后重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
