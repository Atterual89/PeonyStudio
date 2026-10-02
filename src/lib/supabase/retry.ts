import "server-only";

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

const RETRY_DELAYS_MS = [0, 1500, 4000, 8000];

export async function withSupabaseClockSkewRetry<T>(
  operation: () => Promise<T>,
  getError: (result: T) => SupabaseLikeError | null | undefined,
) {
  let lastResult: T | null = null;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const result = await operation();
    lastResult = result;

    const error = getError(result);
    if (!isClockSkewError(error) || attempt === RETRY_DELAYS_MS.length - 1) {
      return result;
    }
  }

  return lastResult as T;
}

export function isClockSkewError(error: SupabaseLikeError | null | undefined) {
  const code = error?.code?.trim().toUpperCase() ?? "";
  const message = error?.message?.trim().toLowerCase() ?? "";

  return code === "PGRST303" || message.includes("jwt issued at future");
}


export async function withSupabaseClockSkewReportRetry<
  T extends { errors: string[] },
>(operation: () => Promise<T>) {
  let lastResult: T | null = null;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const result = await operation();
    lastResult = result;

    const hasClockSkewError = result.errors.some((message) =>
      isClockSkewError({ message }),
    );

    if (!hasClockSkewError || attempt === RETRY_DELAYS_MS.length - 1) {
      return result;
    }
  }

  return lastResult as T;
}
