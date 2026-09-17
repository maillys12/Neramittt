export type OptimisticChatResult = { message: string; brief?: Record<string, unknown> };

type Params = {
  message: string;
  appendUser: (message: string) => void;
  clearInput: () => void;
  ensureDraft: () => Promise<string>;
  requestAssistant: (draftId: string, message: string) => Promise<OptimisticChatResult>;
};

export async function sendChatOptimistically({
  message,
  appendUser,
  clearInput,
  ensureDraft,
  requestAssistant,
}: Params): Promise<OptimisticChatResult | null> {
  const user = message.trim();
  if (!user) return null;

  // These UI updates intentionally happen before the first await so React can
  // render the user's bubble immediately while draft/API work continues.
  appendUser(user);
  clearInput();

  const draftId = await ensureDraft();
  return requestAssistant(draftId, user);
}
