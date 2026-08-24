import { useEffect, useState } from 'react';
import { Clock3, Download, FileImage, FileText, Loader2, Trash2, X } from 'lucide-react';
import type { UnifiedItem } from '@/lib/types';
import { fileKindFromMime, formatBytes, formatRelativeTime } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export function FilePreviewModal({ item, onClose, onDownload, onDelete }: {
  item: UnifiedItem;
  onClose: () => void;
  onDownload: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const kind = fileKindFromMime(item.mimeType ?? '', item.name);
  const isImage = kind === 'image';

  useEffect(() => {
    if (!item.storageKey) { setLoading(false); return; }
    supabase.storage.from('drive-files').createSignedUrl(item.storageKey, 300).then(({ data, error }) => {
      if (!error && data) setUrl(data.signedUrl);
      setLoading(false);
    });
  }, [item.storageKey]);

  const handleDownload = async () => {
    setDownloading(true);
    try { await onDownload(); } finally { setDownloading(false); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-preview" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title"><h2 className="preview-title">{item.name}</h2><button onClick={onClose}><X size={18} /></button></div>
        <div className="preview-body">
          {loading ? <div className="preview-loading"><Loader2 size={28} className="spin" /></div> :
            isImage && url ? <img src={url} alt={item.name} className="preview-image" /> :
              <div className="preview-fallback"><FileImage size={48} /><p>{kind === 'pdf' ? 'PDF document' : kind === 'document' ? 'Document' : kind === 'spreadsheet' ? 'Spreadsheet' : 'File preview'}</p><span>{formatBytes(item.sizeBytes ?? 0)}</span></div>}
        </div>
        <div className="preview-meta">
          <div className="preview-info"><Clock3 size={14} /> Modified {formatRelativeTime(item.updatedAt)}</div>
          <div className="preview-info"><FileText size={14} /> {formatBytes(item.sizeBytes ?? 0)}</div>
        </div>
        <div className="preview-actions">
          <button className="danger-button" onClick={onDelete}><Trash2 size={15} /> Move to trash</button>
          <button className="primary-button" onClick={handleDownload} disabled={downloading}>{downloading ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Download</button>
        </div>
      </div>
    </div>
  );
}
