alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists chat_messages_request_id_idx
  on public.chat_messages ((metadata ->> 'requestId'))
  where role = 'assistant' and metadata ? 'requestId';
