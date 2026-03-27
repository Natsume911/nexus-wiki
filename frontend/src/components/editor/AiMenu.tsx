import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Sparkles, Wand2, CheckCheck, FileText, Languages,
  Mic2, ArrowUpRight, ArrowDownRight, Lightbulb, MessageSquare,
  ChevronLeft, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';
import { aiWrite } from '@/api/ai';
import type { AiAction } from '@/api/ai';

interface AiMenuItem {
  action: AiAction;
  labelKey: TranslationKey;
  icon: React.ReactNode;
  needsInput?: 'targetLang' | 'tone';
}

const iconClass = 'h-3.5 w-3.5';

const AI_ITEMS: AiMenuItem[] = [
  { action: 'improve', labelKey: 'ai.improve' as const, icon: <Wand2 className={iconClass} /> },
  { action: 'fix', labelKey: 'ai.fix' as const, icon: <CheckCheck className={iconClass} /> },
  { action: 'summarize', labelKey: 'ai.summarize' as const, icon: <FileText className={iconClass} /> },
  { action: 'simplify', labelKey: 'ai.simplify' as const, icon: <Lightbulb className={iconClass} /> },
  { action: 'explain', labelKey: 'ai.explain' as const, icon: <MessageSquare className={iconClass} /> },
  { action: 'longer', labelKey: 'ai.longer' as const, icon: <ArrowUpRight className={iconClass} /> },
  { action: 'shorter', labelKey: 'ai.shorter' as const, icon: <ArrowDownRight className={iconClass} /> },
  { action: 'translate', labelKey: 'ai.translate' as const, icon: <Languages className={iconClass} />, needsInput: 'targetLang' },
  { action: 'tone', labelKey: 'ai.tone' as const, icon: <Mic2 className={iconClass} />, needsInput: 'tone' },
];

const LANGUAGES = [
  { value: 'inglese', labelKey: 'ai.lang.english' as const },
  { value: 'italiano', labelKey: 'ai.lang.italian' as const },
  { value: 'francese', labelKey: 'ai.lang.french' as const },
  { value: 'tedesco', labelKey: 'ai.lang.german' as const },
  { value: 'spagnolo', labelKey: 'ai.lang.spanish' as const },
  { value: 'portoghese', labelKey: 'ai.lang.portuguese' as const },
  { value: 'cinese', labelKey: 'ai.lang.chinese' as const },
  { value: 'giapponese', labelKey: 'ai.lang.japanese' as const },
];

const TONES = [
  { value: 'professional', labelKey: 'ai.tone.professional' as const },
  { value: 'casual', labelKey: 'ai.tone.casual' as const },
  { value: 'academic', labelKey: 'ai.tone.academic' as const },
  { value: 'creative', labelKey: 'ai.tone.creative' as const },
  { value: 'direct', labelKey: 'ai.tone.direct' as const },
  { value: 'friendly', labelKey: 'ai.tone.friendly' as const },
];

type View = 'main' | 'languages' | 'tones' | 'loading' | 'result';

interface AiMenuProps {
  editor: Editor;
  onClose: () => void;
}

export function AiMenu({ editor, onClose }: AiMenuProps) {
  const [view, setView] = useState<View>('main');
  const [result, setResult] = useState('');
  const [isError, setIsError] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [currentAction, setCurrentAction] = useState<AiAction | null>(null);
  const t = useT();

  const getSelectedText = useCallback(() => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, '\n');
  }, [editor]);

  const executeAction = useCallback(async (action: AiAction, extra?: { targetLang?: string; tone?: string }) => {
    const text = getSelectedText();
    if (!text.trim()) return;

    setCurrentAction(action);
    setView('loading');
    const labelKeys: Record<AiAction, TranslationKey> = {
      improve: 'ai.loading.improve' as const,
      fix: 'ai.loading.fix' as const,
      summarize: 'ai.loading.summarize' as const,
      translate: 'ai.loading.translate' as const,
      tone: 'ai.loading.tone' as const,
      continue: 'ai.loading.continue' as const,
      longer: 'ai.loading.longer' as const,
      shorter: 'ai.loading.shorter' as const,
      simplify: 'ai.loading.simplify' as const,
      explain: 'ai.loading.explain' as const,
    };
    setLoadingLabel(t(labelKeys[action] || ('ai.loading.default' as const)));

    try {
      const aiResult = await aiWrite({ action, text, ...extra });
      setResult(aiResult);
      setIsError(false);
      setView('result');
    } catch (err: any) {
      setResult(err.message);
      setIsError(true);
      setView('result');
    }
  }, [getSelectedText]);

  const applyResult = useCallback((mode: 'replace' | 'insertBelow') => {
    if (mode === 'replace') {
      const { from, to } = editor.state.selection;
      editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run();
    } else {
      const { to } = editor.state.selection;
      editor.chain().focus().insertContentAt(to, `\n\n${result}`).run();
    }
    onClose();
  }, [editor, result, onClose]);

  const menuClasses = 'w-56 bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden';
  const itemClasses = 'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left';

  if (view === 'loading') {
    return (
      <div className={menuClasses}>
        <div className="flex items-center gap-2.5 px-3 py-4 text-sm text-white/80">
          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          <span>{loadingLabel}</span>
        </div>
      </div>
    );
  }

  if (view === 'result') {
    return (
      <div className={cn(menuClasses, 'w-80')}>
        <div className="max-h-48 overflow-y-auto px-3 py-2">
          <p className={cn('text-xs leading-relaxed whitespace-pre-wrap', isError ? 'text-red-400' : 'text-white/80')}>
            {result}
          </p>
        </div>
        {!isError && (
          <div className="flex border-t border-white/10">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyResult('replace')}
              className="flex-1 px-3 py-2 text-xs font-medium text-violet-400 hover:bg-white/10 transition-colors"
            >
              {t('ai.replace')}
            </button>
            <div className="w-px bg-white/10" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyResult('insertBelow')}
              className="flex-1 px-3 py-2 text-xs font-medium text-violet-400 hover:bg-white/10 transition-colors"
            >
              {t('ai.insertBelow')}
            </button>
          </div>
        )}
        <div className="border-t border-white/10">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (currentAction) {
                setView('main');
                setResult('');
              } else {
                onClose();
              }
            }}
            className="w-full px-3 py-2 text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors text-center"
          >
            {isError ? t('common.close') : t('ai.retryOther')}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'languages') {
    return (
      <div className={menuClasses}>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => setView('main')} className={cn(itemClasses, 'border-b border-white/10 text-white/50')}>
          <ChevronLeft className={iconClass} />
          <span>{t('ai.translateTo')}</span>
        </button>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => executeAction('translate', { targetLang: lang.value })}
            className={itemClasses}
          >
            <span>{t(lang.labelKey)}</span>
          </button>
        ))}
      </div>
    );
  }

  if (view === 'tones') {
    return (
      <div className={menuClasses}>
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => setView('main')} className={cn(itemClasses, 'border-b border-white/10 text-white/50')}>
          <ChevronLeft className={iconClass} />
          <span>{t('ai.changeTone')}</span>
        </button>
        {TONES.map((tone) => (
          <button
            key={tone.value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => executeAction('tone', { tone: tone.value })}
            className={itemClasses}
          >
            <span>{t(tone.labelKey)}</span>
          </button>
        ))}
      </div>
    );
  }

  // Main view
  return (
    <div className={menuClasses}>
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-medium text-white/60">{t('ai.title')}</span>
      </div>
      {AI_ITEMS.map((item) => (
        <button
          key={item.action}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (item.needsInput === 'targetLang') {
              setView('languages');
            } else if (item.needsInput === 'tone') {
              setView('tones');
            } else {
              executeAction(item.action);
            }
          }}
          className={itemClasses}
        >
          {item.icon}
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
