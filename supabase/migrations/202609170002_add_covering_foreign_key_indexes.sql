create index if not exists idx_prompts_draft_id on public.prompts(draft_id);
create index if not exists idx_prompts_prompt_job_id on public.prompts(prompt_job_id);
create index if not exists idx_reference_images_device_id on public.reference_images(device_id);
