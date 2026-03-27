import { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, FileArchive } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import { useT } from '@/i18n';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  onImported: () => void;
}

interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
}

export function ConfluenceImportModal({ open, onOpenChange, spaceSlug, onImported }: Props) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { addToast } = useToastStore();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.zip') || dropped.type === 'application/zip')) {
      setFile(dropped);
      setResult(null);
    } else {
      addToast(t('import.zipOnly'), 'error');
    }
  }, [addToast, t]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/wiki/api/spaces/${spaceSlug}/import/confluence`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      const data = json.data as ImportResult;
      setResult(data);

      if (data.imported > 0) {
        addToast(t('import.pagesImportedToast', { count: data.imported }), 'success');
        onImported();
      }
    } catch (err: any) {
      addToast(t('import.importError', { message: err.message }), 'error');
    } finally {
      setImporting(false);
    }
  }, [file, spaceSlug, addToast, onImported, t]);

  const handleClose = (open: boolean) => {
    if (!importing) {
      setFile(null);
      setResult(null);
      onOpenChange(open);
    }
  };

  return (
    <Modal open={open} onOpenChange={handleClose} title={t('import.title')} className="max-w-lg">
      <p className="text-sm text-text-secondary mb-4">
        {t('import.description')}
      </p>

      {/* Drop zone */}
      {!result && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-border-primary rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById('confluence-zip-input')?.click()}
        >
          <input
            id="confluence-zip-input"
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileArchive className="h-8 w-8 text-accent" />
              <p className="text-sm font-medium text-text-primary">{file.name}</p>
              <p className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">{t('import.dropzone')}</p>
              <p className="text-xs text-text-muted">{t('import.maxSize')}</p>
            </div>
          )}
        </div>
      )}

      {/* Importing progress */}
      {importing && (
        <div className="flex items-center justify-center gap-3 py-6">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-text-secondary">{t('import.importing')}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-text-primary">
              {t('import.pagesImported', { count: result.imported })}
            </span>
            {result.failed > 0 && (
              <span className="text-sm text-red-400">{t('import.errors', { count: result.failed })}</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg bg-bg-tertiary p-3">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-400 mb-1">
                  <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-4">
        {result ? (
          <Button onClick={() => handleClose(false)}>{t('common.close')}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={importing}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleImport} disabled={!file || importing} className="gap-2">
              {importing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {t('import.importing')}</>
              ) : (
                <><Upload className="h-4 w-4" /> {t('common.import')}</>
              )}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
