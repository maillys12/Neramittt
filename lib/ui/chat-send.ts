export type OptimisticChatResult = { message: string; brief?: Record<string, unknown> };

type Params<T extends OptimisticChatResult> = {
  message: string;
  appendUser: (message: string) => void;
  clearInput: () => void;
  ensureDraft: () => Promise<string>;
  requestAssistant: (draftId: string, message: string) => Promise<T>;
};

export async function sendChatOptimistically<T extends OptimisticChatResult>({
  message,
  appendUser,
  clearInput,
  ensureDraft,
  requestAssistant,
}: Params<T>): Promise<T | null> {
  const user = message.trim();
  if (!user) return null;

  // These UI updates intentionally happen before the first await so React can
  // render the user's bubble immediately while draft/API work continues.
  appendUser(user);
  clearInput();

  const draftId = await ensureDraft();
  return requestAssistant(draftId, user);
}
