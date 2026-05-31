interface ApiErrorBody {
  message?: string;
  error?: string;
  validationErrors?: Record<string, string>;
}

export function extractAuthErrorMessage(error: unknown, fallbackMessage: string): string {
  const body = (error as { error?: ApiErrorBody })?.error;

  if (body?.validationErrors) {
    const firstValidationMessage = Object.values(body.validationErrors).find(Boolean);
    if (firstValidationMessage) {
      return firstValidationMessage;
    }
  }

  return body?.message || body?.error || fallbackMessage;
}
