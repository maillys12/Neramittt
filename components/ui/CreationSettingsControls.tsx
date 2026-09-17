'use client';

import { useState } from 'react';
import type { CreationSettings, PromptLanguage, TargetPlatform, VariantCount } from '@/lib/ui/creation-settings';
import { NeramitIcon } from './NeramitIcon';

type Props = {
  value: CreationSettings;
  onChange: (next: CreationSettings) => void;
  compact?: boolean;
};

const platformLabels: Record<TargetPlatform, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  canva: 'Canva AI',
  generic: 'พรอมต์กลาง',
};

const languageLabels: Record<PromptLanguage, string> = { th: 'ภาษาไทย', en: 'English' };

export function CreationSettingsControls({ value, onChange, compact = false }: Props) {
  const [open, setOpen] = useState<'platform'|'language'|null>(null);
  const set = (patch: Partial<CreationSettings>) => onChange({ ...value, ...patch });
  return <div className={`creationSettings${compact ? ' creationSettings--compact' : ''}`}>
    <div className="settingSelectWrap">
      <button type="button" className="toolChip toolChip--button" aria-expanded={open==='platform'} onClick={()=>setOpen(open==='platform'?null:'platform')}>
        <NeramitIcon name="spark" size={17}/><span>{platformLabels[value.platform]}</span><NeramitIcon name="chevronDown" size={15}/>
      </button>
      {open==='platform'&&<div className="settingMenu" role="menu">
        {(Object.keys(platformLabels) as TargetPlatform[]).map(p=><button type="button" role="menuitemradio" aria-checked={value.platform===p} className={value.platform===p?'selected':''} key={p} onClick={()=>{set({platform:p});setOpen(null);}}>{value.platform===p&&<NeramitIcon name="check" size={16}/>}<span>{platformLabels[p]}</span></button>)}
      </div>}
    </div>
    <div className="settingSelectWrap">
      <button type="button" className="toolChip toolChip--button" aria-expanded={open==='language'} onClick={()=>setOpen(open==='language'?null:'language')}>
        <NeramitIcon name="globe" size={17}/><span>{languageLabels[value.language]}</span><NeramitIcon name="chevronDown" size={15}/>
      </button>
      {open==='language'&&<div className="settingMenu" role="menu">
        {(Object.keys(languageLabels) as PromptLanguage[]).map(l=><button type="button" role="menuitemradio" aria-checked={value.language===l} className={value.language===l?'selected':''} key={l} onClick={()=>{set({language:l});setOpen(null);}}>{value.language===l&&<NeramitIcon name="check" size={16}/>}<span>{languageLabels[l]}</span></button>)}
      </div>}
    </div>
    <div className="variantSegment" aria-label="จำนวนรูปแบบ">
      <NeramitIcon name="layers" size={17}/>
      {([1,2,3] as VariantCount[]).map(n=><button type="button" key={n} className={value.variantCount===n?'active':''} aria-pressed={value.variantCount===n} onClick={()=>set({variantCount:n})}>{n}</button>)}
      {!compact&&<span>แบบ</span>}
    </div>
  </div>;
}
