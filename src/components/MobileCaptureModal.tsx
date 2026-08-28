import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Contrast, FolderOpen, ImagePlus, Loader2, RotateCw, ScanLine, Sun, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export type CaptureFolder = { id: string; name: string; parent_id: string | null };
type PageEdit = { rotation: number; brightness: number; contrast: number; grayscale: boolean; cropped: boolean };

const defaultEdit = (): PageEdit => ({ rotation: 0, brightness: 100, contrast: 100, grayscale: false, cropped: false });

export function MobileCaptureModal({
  folders,
  loadingFolders,
  onLoadFolders,
  onUpload,
  onClose,
}: {
  folders: CaptureFolder[];
  loadingFolders: boolean;
  onLoadFolders: () => void;
  onUpload: (files: File[], folderId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [edits, setEdits] = useState<PageEdit[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [destination, setDestination] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [format, setFormat] = useState<'pdf' | 'jpeg'>('pdf');
  const [busy, setBusy] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onLoadFolders();
  }, [onLoadFolders]);

  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (!incoming.length) return;
    setFiles((current) => [...current, ...incoming]);
    setEdits((current) => [...current, ...incoming.map(defaultEdit)]);
    setSelectedPage(files.length);
    if (scanMode) setFormat('pdf');
    event.target.value = '';
  };

  const updateEdit = (patch: Partial<PageEdit>) => {
    setEdits((current) => current.map((edit, index) => index === selectedPage ? { ...edit, ...patch } : edit));
  };

  const removePage = (index: number) => {
    setFiles((current) => current.filter((_, pageIndex) => pageIndex !== index));
    setEdits((current) => current.filter((_, pageIndex) => pageIndex !== index));
    setSelectedPage((current) => Math.max(0, Math.min(current, files.length - 2)));
  };

  const renderEditedFile = (file: File, edit: PageEdit, index: number): Promise<File> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const quarterTurn = edit.rotation % 180 !== 0;
      const sourceWidth = edit.cropped ? image.naturalWidth * 0.9 : image.naturalWidth;
      const sourceHeight = edit.cropped ? image.naturalHeight * 0.9 : image.naturalHeight;
      const sourceX = (image.naturalWidth - sourceWidth) / 2;
      const sourceY = (image.naturalHeight - sourceHeight) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = quarterTurn ? sourceHeight : sourceWidth;
      canvas.height = quarterTurn ? sourceWidth : sourceHeight;
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Could not edit this image.')); return; }
      context.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%)${edit.grayscale ? ' grayscale(100%)' : ''}`;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((edit.rotation * Math.PI) / 180);
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Could not prepare this page.')); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + `-page-${index + 1}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    image.onerror = () => reject(new Error('Could not read this image.'));
    image.src = URL.createObjectURL(file);
  });

  const createPdf = async (filesToSave: File[]) => {
    const pdf = await PDFDocument.create();
    for (const file of filesToSave) {
      const image = await pdf.embedJpg(new Uint8Array(await file.arrayBuffer()));
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    const bytes = await pdf.save();
    return new File([bytes], `Scanned-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' });
  };

  const savePages = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const editedFiles = await Promise.all(files.map((file, index) => renderEditedFile(file, edits[index], index)));
      const outputFiles = format === 'pdf' ? [await createPdf(editedFiles)] : editedFiles;
      await onUpload(outputFiles, destination);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const selectedEdit = edits[selectedPage];
  return (
    <div className="capture-backdrop" onMouseDown={onClose}>
      <div className="capture-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="capture-header"><div><span className="capture-kicker">Mobile capture</span><h2>{files.length ? `${files.length} page${files.length === 1 ? '' : 's'} ready` : 'Add to Drive'}</h2></div><button className="capture-close" onClick={onClose} title="Close"><X size={20} /></button></div>
        {!files.length ? (
          <div className="capture-start">
            <div className="capture-hero-icon"><ScanLine size={30} /></div>
            <h3>Capture documents or photos</h3>
            <p>Build a multi-page scan, adjust each page, then save it to any Drive folder.</p>
            <div className="capture-choice-grid">
              <button onClick={() => { setScanMode(true); setFormat('pdf'); cameraRef.current?.click(); }}><Camera size={22} /><strong>Scan document</strong><span>Capture pages one by one</span></button>
              <button onClick={() => { setScanMode(false); setFormat('jpeg'); galleryRef.current?.click(); }}><ImagePlus size={22} /><strong>Choose from gallery</strong><span>Select multiple images</span></button>
            </div>
          </div>
        ) : (
          <>
            <div className="capture-preview-wrap">
              <div className="capture-preview-stage">
                <img src={URL.createObjectURL(files[selectedPage])} alt={`Page ${selectedPage + 1}`} style={{ filter: `brightness(${selectedEdit.brightness}%) contrast(${selectedEdit.contrast}%)${selectedEdit.grayscale ? ' grayscale(100%)' : ''}`, transform: `rotate(${selectedEdit.rotation}deg)` }} />
              </div>
              <div className="capture-page-tools"><button onClick={() => updateEdit({ rotation: (selectedEdit.rotation + 90) % 360 })}><RotateCw size={17} /> Rotate</button><button onClick={() => updateEdit({ cropped: !selectedEdit.cropped })}>Crop</button><button onClick={() => updateEdit({ brightness: selectedEdit.brightness === 100 ? 115 : 100 })}><Sun size={17} /> Enhance</button><button onClick={() => updateEdit({ contrast: selectedEdit.contrast === 100 ? 120 : 100 })}><Contrast size={17} /> Contrast</button><button className={selectedEdit.grayscale ? 'active' : ''} onClick={() => updateEdit({ grayscale: !selectedEdit.grayscale })}>B&W</button><button onClick={() => setEdits((current) => current.map((edit, index) => index === selectedPage ? defaultEdit() : edit))}>Reset</button></div>
            </div>
            <div className="capture-thumbnails">{files.map((file, index) => <button key={`${file.name}-${index}`} className={index === selectedPage ? 'selected' : ''} onClick={() => setSelectedPage(index)}><img src={URL.createObjectURL(file)} alt={`Page ${index + 1}`} /><span>{index + 1}</span><i onClick={(event) => { event.stopPropagation(); removePage(index); }}><X size={12} /></i></button>)}</div>
            <button className="capture-add-page" onClick={() => { setScanMode(true); setFormat('pdf'); cameraRef.current?.click(); }}><ScanLine size={17} /> Scan another page</button>
            <div className="capture-format"><span>Save as</span><button className={format === 'pdf' ? 'active' : ''} onClick={() => setFormat('pdf')}>PDF document</button><button className={format === 'jpeg' ? 'active' : ''} onClick={() => setFormat('jpeg')}>JPEG pages</button></div>
            <label className="capture-destination"><span><FolderOpen size={17} /> Save location</span><select value={destination ?? ''} onChange={(event) => setDestination(event.target.value || null)} disabled={loadingFolders}><option value="">My Drive</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
            <div className="capture-footer"><button className="outline-button" onClick={onClose}>Discard scans</button><button className="primary-button" onClick={savePages} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Save {format === 'pdf' ? 'PDF' : 'pages'}</button></div>
          </>
        )}
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={addFiles} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={addFiles} />
      </div>
    </div>
  );
}
