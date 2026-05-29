export function extractAuthErrorMessage(error: unknown, fallbackMessage: string): string {
  const backendMessage = (error as { error?: { message?: string; error?: string } })?.error;
  return backendMessage?.message || backendMessage?.error || fallbackMessage;
}