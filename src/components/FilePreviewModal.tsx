import { useEffect, useRef, useState } from 'react';
import { Clock3, Download, Expand, FileImage, FileText, Loader2, Trash2, X } from 'lucide-react';
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
  const [previewError, setPreviewError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const kind = fileKindFromMime(item.mimeType ?? '', item.name);
  const isImage = kind === 'image';
  const isPdf = kind === 'pdf';
  const isText = kind === 'document';
  const isVideo = item.mimeType?.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(item.name);
  const isOfficeDocument = /\.(docx?|xlsx?|pptx?)$/i.test(item.name);

  useEffect(() => {
    if (!item.storageKey) { setLoading(false); return; }
    supabase.storage.from('drive-files').createSignedUrl(item.storageKey, 3600).then(({ data, error }) => {
      if (!error && data) setUrl(data.signedUrl);
      else setPreviewError('Could not load preview.');
      setLoading(false);
    });
  }, [item.storageKey]);

  const handleDownload = async () => {
    setDownloading(true);
    try { await onDownload(); } finally { setDownloading(false); }
  };

  const handleFullscreen = async () => {
    if (!previewRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await previewRef.current.requestFullscreen();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-preview" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-title"><h2 className="preview-title">{item.name}</h2><div className="preview-title-actions"><button onClick={handleFullscreen} title="Full screen"><Expand size={17} /></button><button onClick={onClose} title="Close"><X size={18} /></button></div></div>
        <div className="preview-body" ref={previewRef}>
          {loading ? (
            <div className="preview-loading"><Loader2 size={28} className="spin" /></div>
          ) : previewError ? (
            <div className="preview-fallback"><FileImage size={48} /><p>Preview unavailable</p><span>{previewError}</span></div>
          ) : isImage && url ? (
            <img src={url} alt={item.name} className="preview-image" />
          ) : isPdf && url ? (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              className="preview-pdf"
              title="PDF Preview"
              onError={() => setPreviewError('Could not load PDF preview')}
            />
          ) : isVideo && url ? (
            <video src={url} className="preview-video" controls playsInline onError={() => setPreviewError('Could not load video preview')} />
          ) : isText && url ? (
            <iframe
              src={isOfficeDocument ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}` : url}
              className="preview-text"
              title="Document Preview"
              sandbox="allow-same-origin"
              onError={() => setPreviewError('Could not load document preview')}
            />
          ) : (
            <div className="preview-fallback"><FileImage size={48} /><p>{kind === 'pdf' ? 'PDF document' : kind === 'document' ? 'Document' : kind === 'spreadsheet' ? 'Spreadsheet' : 'File preview'}</p><span>{formatBytes(item.sizeBytes ?? 0)}</span></div>
          )}
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
