'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getOrCreateDeviceToken } from '@/lib/device/token';
import { AiThinkingBubble, WorkStatusBubble } from '@/components/ui/LoadingStates';
import { Toast } from '@/components/ui/Toast';
import { chatSummaryRows } from '@/lib/ui/format';
import { CreationSettingsControls } from '@/components/ui/CreationSettingsControls';
import { NeramitIcon } from '@/components/ui/NeramitIcon';
import { normalizeCreationSettings, settingsPatch, type CreationSettings } from '@/lib/ui/creation-settings';
import { sendChatOptimistically, type OptimisticChatResult } from '@/lib/ui/chat-send';
import { splitChatMarkdown } from '@/lib/ui/chat-markdown';
import { hasFencedPromptBlocks, POST_OUTPUT_GUIDANCE_THAI } from '@/lib/ui/image-prompt-policy';
import { readChatEventStream } from '@/lib/chat/ndjson';
import type { AssistantTurn, WorkStage } from '@/lib/chat/contracts';
import { isReplyGroupActive, type SmartReplySelection } from '@/lib/chat/smart-replies';
import { StructuredAssistantTurn } from '@/components/chat/StructuredAssistantTurn';

type Item = { id: string; role: 'user' | 'assistant'; content: string; turn?: AssistantTurn };
type Brief = Record<string, unknown>;
type StreamResult = OptimisticChatResult & { turn?: AssistantTurn; requestId: string };
type RetryState = { message: string; selection?: SmartReplySelection; requestId: string };

function localId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export default function ChatClient() {
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [workStage, setWorkStage] = useState<WorkStage | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [brief, setBrief] = useState<Brief>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryState, setRetryState] = useState<RetryState | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<CreationSettings>(() => normalizeCreationSettings({}));
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const summary = useMemo(() => chatSummaryRows(brief, settings.language), [brief, settings.language]);

  useEffect(() => {
    if (items.length || busy) chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [items, busy, workStage]);

  useEffect(() => {
    if (!busy) {
      setElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function persistSettings(next: CreationSettings) {
    setSettings(next);
    setBrief(value => ({ ...value, ...settingsPatch(next) }));
    if (!draft) return;
    try {
      await fetch(`/api/drafts/${draft}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-neramit-device': getOrCreateDeviceToken() },
        body: JSON.stringify({ brief: { ...brief, ...settingsPatch(next) } }),
      });
    } catch {
      // The selected setting remains optimistic and will be persisted on the next chat turn.
    }
  }

  async function ensureDraft() {
    if (draft) return draft;
    const response = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-neramit-device': getOrCreateDeviceToken() },
      body: JSON.stringify({ mode: 'chat', brief: { ...brief, ...settingsPatch(settings) } }),
    });
    const body = await response.json();
    if (!body.draft?.id) throw new Error(body.error || (settings.language === 'en' ? 'Could not create a draft.' : 'สร้างดราฟต์ไม่สำเร็จ'));
    const id = body.draft.id as string;
    setDraft(id);
    return id;
  }

  async function requestAssistant(id: string, user: string, requestId: string, selection?: SmartReplySelection): Promise<StreamResult> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-neramit-device': getOrCreateDeviceToken() },
      body: JSON.stringify({ draftId: id, requestId, message: user, settings, selection }),
    });
    if (response.headers.get('content-type')?.includes('application/x-ndjson')) {
      let turn: AssistantTurn | undefined;
      let completed = false;
      let streamError = '';
      await readChatEventStream(response, event => {
        if (event.type === 'stage') setWorkStage(event.stage);
        if (event.type === 'turn') turn = event.turn;
        if (event.type === 'error') streamError = event.message;
        if (event.type === 'done') completed = true;
      });
      if (streamError) throw new Error(streamError);
      if (!turn || !completed) throw new Error(settings.language === 'en' ? 'The response stream was interrupted.' : 'การเชื่อมต่อคำตอบขาดช่วง');
      return { message: turn.message, brief: { ...brief, ...turn.briefPatch }, turn, requestId };
    }

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || (settings.language === 'en' ? 'Could not send the message.' : 'ส่งข้อความไม่สำเร็จ'));
    return { message: body.message, brief: body.brief && typeof body.brief === 'object' ? body.brief : undefined, requestId };
  }

  function acceptResult(result: StreamResult) {
    setItems(value => [...value, { id: localId(), role: 'assistant', content: result.message, turn: result.turn }]);
    if (result.brief) {
      setBrief(result.brief);
      setSettings(normalizeCreationSettings(result.brief));
    }
    setRetryState(null);
  }

  async function sendMessage(originalInput: string, selection?: SmartReplySelection) {
    const original = originalInput.trim();
    if (!original || busy) return;
    const requestId = crypto.randomUUID();
    setBusy(true);
    setWorkStage(null);
    setError('');
    try {
      const result = await sendChatOptimistically<StreamResult>({
        message: original,
        appendUser: user => setItems(value => [...value, { id: localId(), role: 'user', content: user }]),
        clearInput: () => setMsg(''),
        ensureDraft,
        requestAssistant: (id, user) => requestAssistant(id, user, requestId, selection),
      });
      if (result) acceptResult(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (settings.language === 'en' ? 'An error occurred.' : 'เกิดข้อผิดพลาด'));
      setRetryState({ message: original, selection, requestId });
    } finally {
      setBusy(false);
      setWorkStage(null);
    }
  }

  async function retryLastRequest() {
    if (!retryState || busy) return;
    setBusy(true);
    setWorkStage(null);
    setError('');
    try {
      const id = await ensureDraft();
      const result = await requestAssistant(id, retryState.message, retryState.requestId, retryState.selection);
      acceptResult(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (settings.language === 'en' ? 'An error occurred.' : 'เกิดข้อผิดพลาด'));
    } finally {
      setBusy(false);
      setWorkStage(null);
    }
  }

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(settings.language === 'en' ? 'Prompt copied' : 'คัดลอกพรอมต์แล้ว');
      window.setTimeout(() => setNotice(''), 1600);
    } catch {
      setError(settings.language === 'en' ? 'Could not copy the prompt' : 'คัดลอกพรอมต์ไม่สำเร็จ');
    }
  }

  const isEnglish = settings.language === 'en';
  const starter = isEnglish ? 'What would you like to create today?' : 'วันนี้อยากสร้างงานอะไรครับ?';
  const placeholder = isEnglish ? 'Describe your idea...' : 'พิมพ์ไอเดียของคุณ...';
  const retryLabel = isEnglish ? 'Retry the last request' : 'ลองส่งคำขอล่าสุดอีกครั้ง';

  return <div className="chatWorkspace">
    <section className="chatPanel">
      <div className="chatToolbar"><CreationSettingsControls value={settings} onChange={persistSettings} compact/></div>
      <div className="chatBox" aria-live="polite">
        {items.length === 0 && <div className="starterMessage"><span className="aiAvatar"><NeramitIcon name="spark" size={21}/></span><div><strong>{isEnglish ? 'Chat with Neramit' : 'คุยกับเนรมิต'}</strong><p>{starter}</p></div></div>}
        {items.map((item, index) => <div key={item.id} className={`messageRow ${item.role}`}>
          <span className="messageAvatar" aria-hidden="true"><NeramitIcon name={item.role === 'assistant' ? 'spark' : 'user'} size={18}/></span>
          {item.role === 'assistant' ? <div className="bubble assistant bubble--rich">
            {item.turn ? <StructuredAssistantTurn
              turn={item.turn}
              language={settings.language}
              replyDisabled={!isReplyGroupActive(index, items.length - 1, Boolean(selectedGroups[item.id]), busy)}
              selectedOptionId={selectedGroups[item.id]}
              onReply={selection => {
                setSelectedGroups(value => ({ ...value, [item.id]: selection.optionId }));
                void sendMessage(selection.label, selection);
              }}
              onCopy={text => { void copyPrompt(text); }}
            /> : <div className="assistantContent">
              {splitChatMarkdown(item.content).map((segment, segmentIndex) => segment.type === 'code' ? <div className="promptCodeBlock" key={`${item.id}-${segmentIndex}`}><div className="promptCodeHeader"><span>Prompt</span><button type="button" onClick={() => void copyPrompt(segment.content)}><NeramitIcon name="document" size={16}/>{isEnglish ? 'Copy' : 'คัดลอก'}</button></div><pre><code>{segment.content}</code></pre></div> : <div className="assistantText" key={`${item.id}-${segmentIndex}`}>{segment.content}</div>)}
              {hasFencedPromptBlocks(item.content) && <div className="summaryTip" role="note"><NeramitIcon name="spark" size={20}/><span>{isEnglish ? 'Copy only the prompt block above into your image-generation tool.' : POST_OUTPUT_GUIDANCE_THAI}</span></div>}
            </div>}
          </div> : <div className="bubble user">{item.content}</div>}
        </div>)}
        {busy && (workStage ? <WorkStatusBubble stage={workStage} language={settings.language} elapsedSeconds={elapsedSeconds}/> : <AiThinkingBubble language={settings.language}/>)}
        {!busy && retryState && <button type="button" className="retryChatButton" onClick={() => void retryLastRequest()}><NeramitIcon name="refresh" size={17}/>{retryLabel}</button>}
        <div ref={chatEndRef} aria-hidden="true"/>
      </div>
      <div className="composerCard"><textarea value={msg} onChange={event => setMsg(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(msg); } }} placeholder={placeholder} rows={2}/><button className="sendButton" onClick={() => void sendMessage(msg)} disabled={busy || !msg.trim()} aria-label={isEnglish ? 'Send message' : 'ส่งข้อความ'}><NeramitIcon name="send" size={23}/></button></div>
      <div className="chatBottom"><span>{isEnglish ? 'Up to 4 reference images' : 'แนบภาพอ้างอิงได้สูงสุด 4 ภาพ'}</span><button className="textButton iconTextButton" onClick={() => { setItems([]); setBrief({}); setDraft(''); setSettings(normalizeCreationSettings({})); setSelectedGroups({}); setRetryState(null); }}><NeramitIcon name="refresh" size={16}/>{isEnglish ? 'Start over' : 'เริ่มใหม่'}</button></div>
      {error && <Toast message={error} tone="error"/>}{notice && <Toast message={notice} tone="success"/>}
    </section>
    <aside className="summaryPanel">
      <div className="summaryTitle"><div><span className="eyebrowSmall">{isEnglish ? 'Your creative brief' : 'สรุปไอเดียของคุณ'}</span><h2>{isEnglish ? 'What Neramit understands' : 'รายละเอียดที่เนรมิตเข้าใจ'}</h2></div><NeramitIcon name="edit" size={19}/></div>
      <div className="summaryRows">{summary.length ? summary.map(([label, value]) => <div className="summaryRow" key={label}><span>{label}</span><strong>{value}</strong></div>) : <div className="summaryEmpty">{isEnglish ? 'Start chatting and the brief will update automatically.' : 'เริ่มคุยก่อน แล้วสรุปงานจะขึ้นตรงนี้อัตโนมัติ'}</div>}</div>
      <div className="summaryTip"><NeramitIcon name="spark" size={23}/><span>{isEnglish ? 'When enough information is available, Neramit will research and build the prompt here.' : <>เมื่อข้อมูลเพียงพอ เนรมิตจะค้นคว้า<br/>และสร้างพรอมต์ในแชทอัตโนมัติ</>}</span></div>
    </aside>
  </div>;
}
