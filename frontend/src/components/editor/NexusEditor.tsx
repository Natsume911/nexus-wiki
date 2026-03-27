import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TipTapTable from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { ResizableImage } from './ResizableImageExtension';
import TipTapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { EditorToolbar } from './EditorToolbar';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { DragHandle } from './DragHandleExtension';
import { Callout } from './CalloutExtension';
import { ImageUploadExtension } from './ImageUploadExtension';
import { SlashCommandExtension } from './SlashCommand';
import { PageLink } from './PageLinkExtension';
import { MermaidBlock } from './MermaidExtension';
import { MathBlock, MathInline } from './MathExtension';
import { DetailsBlock, DetailsSummary, DetailsContent } from './DetailsExtension';
import { Columns, Column } from './ColumnsExtension';
import { TabGroup, TabItem } from './TabsExtension';
import { StatusBadge } from './StatusBadgeExtension';
import { EmojiExtension } from './EmojiExtension';
import { TableOfContents, FloatingToc, HeadingIdExtension } from './TocExtension';
import { Mention } from './MentionExtension';
import { VideoEmbed } from './VideoEmbedExtension';
import { MarkdownPaste } from './extensions/MarkdownPaste';
import { CollabHistory } from './extensions/CollabHistory';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { useAutoSave } from './useAutoSave';
import { CollaborationStatus } from './CollaborationStatus';
import { useCollaboration, getUserColor } from '@/hooks/useCollaboration';
import { lowlight } from './languages';
import { uploadFile, uploadFileWithProgress } from '@/api/attachments';
import { updatePageContent } from '@/api/pages';
import { useUploadStore } from '@/stores/uploadStore';
import { useSpaceStore } from '@/stores/spaceStore';
import { useToastStore } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { useT, useI18nStore } from '@/i18n';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MeetingRecorder } from './MeetingRecorder';
import { FindReplace } from './FindReplace';
import { aiWrite } from '@/api/ai';
import './EditorStyles.css';

interface NexusEditorProps {
  pageId: string;
  initialContent: Record<string, unknown>;
  readingMode?: boolean;
  onCollaboratorsChange?: (collaborators: import('@/hooks/useCollaboration').Collaborator[]) => void;
}

export function NexusEditor({ pageId, initialContent, readingMode = false, onCollaboratorsChange }: NexusEditorProps) {
  const { currentSpace } = useSpaceStore();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const { uploads, addUpload, updateProgress, setDone, setError } = useUploadStore();
  const { provider, ydoc, collaborators, connected, synced, setTyping, hasUnsyncedChanges, ready: collabReady } = useCollaboration(readingMode ? undefined : pageId);
  const isCollabMode = !readingMode && !!ydoc && !!provider;
  const t = useT();

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const t = useI18nStore.getState().t;
    if (!currentSpace) throw new Error(t('editor.noSpaceSelected'));
    try {
      const result = await uploadFile(currentSpace.slug, file, pageId);
      addToast(t('editor.imageUploaded'), 'success');
      return result.url;
    } catch (err) {
      addToast(t('editor.imageUploadError'), 'error');
      throw err;
    }
  }, [currentSpace, pageId, addToast]);

  const extensions = useMemo(() => {
    const exts = [
      StarterKit.configure({
        codeBlock: false,
        // Disable history when in collab mode — Yjs handles undo/redo
        ...(isCollabMode ? { history: false } : {}),
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      DragHandle,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      TipTapTable.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ResizableImage,
      TipTapLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Placeholder.configure({
        placeholder: t('editor.placeholder'),
      }),
      Typography,
      CharacterCount,
      Callout,
      ImageUploadExtension.configure({ uploadFn: handleImageUpload }),
      SlashCommandExtension,
      PageLink,
      MermaidBlock,
      MathBlock,
      MathInline,
      DetailsBlock,
      DetailsSummary,
      DetailsContent,
      Columns,
      Column,
      TabGroup,
      TabItem,
      StatusBadge,
      EmojiExtension,
      TableOfContents,
      HeadingIdExtension,
      Mention,
      VideoEmbed,
      MarkdownPaste,
    ];

    // Add collaboration extensions when in collab mode
    if (isCollabMode && ydoc && provider) {
      exts.push(
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: user?.name || user?.email || t('common.anonymous'),
            color: getUserColor(user?.id || user?.email || 'anon'),
          },
        }),
        CollabHistory, // Per-user undo/redo via Yjs UndoManager
      );
    }

    return exts;
  }, [handleImageUpload, isCollabMode, ydoc, provider, user]);

  const editor = useEditor({
    extensions,
    // In collab mode, Y.Doc is the source of truth — don't set initial content
    content: isCollabMode ? undefined : initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
      },
    },
  });

  const handleUploadFiles = useCallback((files: FileList) => {
    if (!currentSpace || !editor) return;
    const t = useI18nStore.getState().t;
    Array.from(files).forEach(async (file) => {
      const uid = Date.now().toString(36) + Math.random().toString(36).slice(2);
      addUpload(uid, file.name);
      try {
        const result = await uploadFileWithProgress(
          currentSpace.slug,
          file,
          pageId,
          (pct) => updateProgress(uid, pct),
        );
        setDone(uid);
        if (file.type.startsWith('image/')) {
          editor.chain().focus().setImage({ src: result.url }).run();
        } else {
          editor.chain().focus().insertContent({
            type: 'text',
            marks: [{ type: 'link', attrs: { href: result.url, target: '_blank' } }],
            text: result.filename,
          }).run();
        }
        addToast(t('editor.fileUploaded', { name: file.name }), 'success');
        window.dispatchEvent(new CustomEvent('nexus:attachments-changed'));
      } catch (err: any) {
        setError(uid);
        addToast(t('editor.fileUploadError', { name: file.name, message: err.message }), 'error');
      }
    });
  }, [currentSpace, editor, pageId, addUpload, updateProgress, setDone, setError, addToast]);

  const [showMeetingRecorder, setShowMeetingRecorder] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);

  // Ctrl+H → Find & Replace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Warn user before leaving if uploads in progress OR unsaved collaborative changes
  useEffect(() => {
    const activeUploads = uploads.filter((u) => u.status === 'uploading');
    const shouldWarn = activeUploads.length > 0 || hasUnsyncedChanges;
    if (!shouldWarn) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploads, hasUnsyncedChanges]);

  // Expose collaborators to parent
  useEffect(() => {
    if (onCollaboratorsChange) {
      onCollaboratorsChange(collaborators);
    }
  }, [collaborators, onCollaboratorsChange]);

  // Typing awareness — fire on editor updates
  useEffect(() => {
    if (!editor || !isCollabMode) return;
    const handler = () => setTyping(true);
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, isCollabMode, setTyping]);

  // Safety net: if Y.Doc synced but empty, populate from initialContent
  useEffect(() => {
    if (!isCollabMode || !synced || !editor || editor.isDestroyed || !ydoc) return;
    const fragment = ydoc.getXmlFragment('default');
    if (fragment.length === 0 && initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [synced, isCollabMode, editor, ydoc, initialContent]);

  // HTTP autosave: primary when solo, safety net when collab is connected
  const { save: saveNow } = useAutoSave(editor, pageId, isCollabMode && connected);

  // Expose saveNow for parent components (e.g., toggle edit needs to save before exiting)
  useEffect(() => {
    const handler = async () => {
      if (editor && !editor.isDestroyed && pageId) {
        try {
          await updatePageContent(pageId, editor.getJSON());
        } catch {}
      }
      window.dispatchEvent(new Event('nexus:save-done'));
    };
    window.addEventListener('nexus:save-now', handler);
    return () => window.removeEventListener('nexus:save-now', handler);
  }, [editor, pageId]);

  // Keep a snapshot of editor content so it survives collab disconnect
  const contentSnapshotRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!editor) return;
    const capture = () => { contentSnapshotRef.current = editor.getJSON(); };
    capture();
    editor.on('update', capture);
    return () => { editor.off('update', capture); };
  }, [editor]);

  // Force-save when leaving edit mode (readingMode: false → true)
  const prevReadingModeRef = useRef(readingMode);
  useEffect(() => {
    if (readingMode && !prevReadingModeRef.current && editor && !editor.isDestroyed && pageId) {
      // Always get fresh content from editor, not stale snapshot
      const content = editor.getJSON();
      updatePageContent(pageId, content).catch(() => {});
    }
    prevReadingModeRef.current = readingMode;
  }, [readingMode, editor, pageId]);

  // Also force-save on unmount (navigating away while editing)
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed && pageId && !readingMode) {
        const content = editor.getJSON();
        fetch(`/wiki/api/pages/${pageId}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          keepalive: true, // ensures request completes even if page unloads
        }).catch(() => {});
      }
    };
  }, [editor, pageId, readingMode]);

  // Listen for meeting recorder open event from slash command
  useEffect(() => {
    const handler = () => setShowMeetingRecorder(true);
    window.addEventListener('nexus:open-meeting-recorder', handler);
    return () => window.removeEventListener('nexus:open-meeting-recorder', handler);
  }, []);

  // Listen for AI continue writing event from slash command
  useEffect(() => {
    if (!editor) return;
    const handler = async () => {
      const t = useI18nStore.getState().t;
      // Get text before cursor as context (last ~2000 chars)
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 2000), from, '\n');
      if (!textBefore.trim()) {
        addToast(t('editor.aiWriteFirst'), 'warning');
        return;
      }
      addToast(t('editor.aiWriting'), 'info');
      try {
        const result = await aiWrite({ action: 'continue', text: textBefore });
        editor.chain().focus().insertContent(result).run();
        addToast(t('editor.aiTextInserted'), 'success');
      } catch (err: any) {
        addToast(t('editor.aiError', { message: err.message }), 'error');
      }
    };
    window.addEventListener('nexus:ai-continue-writing', handler);
    return () => window.removeEventListener('nexus:ai-continue-writing', handler);
  }, [editor, addToast]);

  // Listen for file picker open event from slash command
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      if (detail?.accept) input.accept = detail.accept;
      input.onchange = () => {
        if (input.files?.length) handleUploadFiles(input.files);
      };
      input.click();
    };
    window.addEventListener('nexus:open-file-picker', handler);
    return () => window.removeEventListener('nexus:open-file-picker', handler);
  }, [handleUploadFiles]);

  // Toggle editable state based on reading mode
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!readingMode);
    }
  }, [editor, readingMode]);

  // Add copy buttons to code blocks
  useEffect(() => {
    if (!editor) return;
    const addCopyButtons = () => {
      const editorEl = editor.view.dom;
      editorEl.querySelectorAll('pre').forEach((pre) => {
        if (pre.querySelector('.code-copy-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.textContent = useI18nStore.getState().t('editor.codeCopy');
        btn.contentEditable = 'false';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const code = pre.querySelector('code');
          const text = code?.textContent || pre.textContent || '';
          const t = useI18nStore.getState().t;
          navigator.clipboard.writeText(text).then(() => {
            btn.textContent = t('editor.codeCopied');
            setTimeout(() => { btn.textContent = t('editor.codeCopy'); }, 1500);
          });
        });
        pre.style.position = 'relative';
        pre.appendChild(btn);
      });
    };
    addCopyButtons();
    editor.on('update', addCopyButtons);
    return () => { editor.off('update', addCopyButtons); };
  }, [editor]);

  // Track previous pageId to distinguish navigation from mode toggle
  const prevPageIdRef = useRef(pageId);

  // Update content when page changes (skip in collab mode — Y.Doc is source of truth)
  useEffect(() => {
    if (isCollabMode) return;
    if (!editor || editor.isDestroyed) return;

    const pageChanged = prevPageIdRef.current !== pageId;
    prevPageIdRef.current = pageId;

    if (pageChanged) {
      // Page navigation — always sync from server content
      editor.commands.setContent(initialContent);
      return;
    }

    // Collab mode just turned off (edit → view) — editor may have lost Y.Doc content.
    // Restore from snapshot (most recent editor content) or fall back to initialContent.
    const doc = editor.getJSON();
    const isEmpty = !doc?.content?.length ||
      (doc.content.length === 1 && doc.content[0].type === 'paragraph' &&
        (!doc.content[0].content || doc.content[0].content.length === 0));

    if (isEmpty) {
      const restore = contentSnapshotRef.current || initialContent;
      if (restore) editor.commands.setContent(restore);
    }
  }, [pageId, isCollabMode, initialContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for collab provider before showing editor (prevents loading content twice)
  if (!readingMode && !collabReady) return (
    <div className="rounded-lg border border-border-primary bg-bg-primary overflow-hidden animate-pulse">
      <div className="h-10 bg-bg-secondary border-b border-border-primary" />
      <div className="px-6 py-4 space-y-3">
        <div className="h-8 bg-bg-tertiary rounded w-3/4" />
        <div className="h-4 bg-bg-tertiary rounded w-full" />
        <div className="h-4 bg-bg-tertiary rounded w-5/6" />
      </div>
    </div>
  );

  if (!editor) return (
    <div className="rounded-lg border border-border-primary bg-bg-primary overflow-hidden animate-pulse">
      <div className="h-10 bg-bg-secondary border-b border-border-primary" />
      <div className="px-6 py-4 space-y-3">
        <div className="h-8 bg-bg-tertiary rounded w-3/4" />
        <div className="h-4 bg-bg-tertiary rounded w-full" />
        <div className="h-4 bg-bg-tertiary rounded w-5/6" />
        <div className="h-4 bg-bg-tertiary rounded w-2/3" />
        <div className="h-20 bg-bg-tertiary rounded w-full mt-4" />
        <div className="h-4 bg-bg-tertiary rounded w-4/5" />
        <div className="h-4 bg-bg-tertiary rounded w-3/4" />
      </div>
    </div>
  );

  return (
    <div className="flex gap-4">
      <div className={`flex-1 rounded-lg overflow-hidden bg-bg-primary min-w-0 ${readingMode ? '' : 'border border-border-primary'}`}>
        {!readingMode && <EditorToolbar editor={editor} onUploadFiles={handleUploadFiles} isCollabMode={isCollabMode} />}
        {!readingMode && <EditorBubbleMenu editor={editor} />}
        {showFindReplace && editor && <FindReplace editor={editor} onClose={() => setShowFindReplace(false)} />}
        <div className={readingMode ? 'px-1 py-2' : 'px-6 py-4'} data-testid="editor-content">
          <EditorContent editor={editor} />
        </div>
        {!readingMode && (
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-border-primary text-xs text-text-muted">
            <span>{editor.storage.characterCount?.characters()} {t('editor.characters')}</span>
            <div className="flex items-center gap-4">
              {uploads.length > 0 && (() => {
                const active = uploads.filter((u) => u.status === 'uploading');
                const avgPct = active.length
                  ? Math.round(active.reduce((s, u) => s + u.progress, 0) / active.length)
                  : 100;
                return (
                  <div className="flex items-center gap-2">
                    {active.length > 0 && (
                      <svg className="h-3 w-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                      </svg>
                    )}
                    <span className="text-accent">
                      {active.length > 0
                        ? t('editor.uploadingFiles', { count: active.length, percent: avgPct })
                        : t('editor.filesUploaded', { count: uploads.length })}
                    </span>
                    <div className="w-16 h-1 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${avgPct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
              {isCollabMode && (connected || synced || collaborators.length > 0) && (
                <CollaborationStatus
                  connected={connected}
                  synced={synced}
                  collaborators={collaborators}
                  hasUnsyncedChanges={hasUnsyncedChanges}
                />
              )}
              <span>{editor.storage.characterCount?.words()} {t('editor.words')}</span>
            </div>
          </div>
        )}
      </div>
      {/* Floating TOC sidebar */}
      <div className="hidden xl:block w-48 shrink-0 sticky top-4 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
        <FloatingToc editor={editor} />
      </div>

      {/* Meeting Recorder modal */}
      {showMeetingRecorder && (
        <MeetingRecorder
          onInsert={(content) => {
            const nodes = Array.isArray(content) ? content : [content];
            editor.chain().focus().insertContent(nodes).run();
          }}
          onClose={() => setShowMeetingRecorder(false)}
        />
      )}
    </div>
  );
}
