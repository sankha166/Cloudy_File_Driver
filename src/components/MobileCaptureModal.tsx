import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Contrast, FolderOpen, ImagePlus, Loader2, RotateCw, ScanLine, Sun, X } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

export type CaptureFolder = { id: string; name: string; parent_id: string | null };
type PageEdit = { rotation: number; brightness: number; contrast: number; grayscale: boolean; cropped: boolean };
const defaultEdit = (): PageEdit => ({ rotation: 0, brightness: 100, contrast: 100, grayscale: false, cropped: false });

export function MobileCaptureModal({ folders, loadingFolders, onLoadFolders, onUpload, onClose }: {
  folders: CaptureFolder[]; loadingFolders: boolean; onLoadFolders: () => void;
  onUpload: (files: File[], folderId: string | null) => Promise<void>; onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [edits, setEdits] = useState<PageEdit[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [destination, setDestination] = useState<string | null>(null);
  const [format, setFormat] = useState<'pdf' | 'jpeg'>('pdf');
  const [applyToAll, setApplyToAll] = useState(false);
  const [stage, setStage] = useState<'start' | 'camera' | 'edit'>('start');
  const [cameraError, setCameraError] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { onLoadFolders(); }, [onLoadFolders]);
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const startCamera = async () => {
    setCameraError(''); setStage('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch { setCameraError('Camera access was blocked. Choose pages from your gallery instead.'); }
  };

  const addPage = (file: File) => {
    setFiles((current) => [...current, file]);
    setEdits((current) => [...current, defaultEdit()]);
    setSelectedPage(files.length);
  };

  const capturePage = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 960;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) addPage(new File([blob], `scan-page-${files.length + 1}.jpg`, { type: 'image/jpeg' })); }, 'image/jpeg', 0.92);
  };

  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  const addGalleryPages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'));
    incoming.forEach(addPage); event.target.value = '';
    if (incoming.length) setStage('edit');
  };
  const updateEdit = (patch: Partial<PageEdit>) => setEdits((current) => current.map((edit, index) => applyToAll || index === selectedPage ? { ...edit, ...patch } : edit));
  const toggleApplyToAll = (enabled: boolean) => {
    setApplyToAll(enabled);
    if (enabled) setEdits((current) => current.map(() => ({ ...current[selectedPage] })));
  };
  const removePage = (index: number) => {
    setFiles((current) => current.filter((_, pageIndex) => pageIndex !== index));
    setEdits((current) => current.filter((_, pageIndex) => pageIndex !== index));
    setSelectedPage((current) => Math.max(0, Math.min(current, files.length - 2)));
  };

  const renderEditedFile = (file: File, edit: PageEdit, index: number): Promise<File> => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = edit.cropped ? image.naturalWidth * 0.9 : image.naturalWidth;
      const height = edit.cropped ? image.naturalHeight * 0.9 : image.naturalHeight;
      const x = (image.naturalWidth - width) / 2; const y = (image.naturalHeight - height) / 2;
      const turned = edit.rotation % 180 !== 0; const canvas = document.createElement('canvas');
      canvas.width = turned ? height : width; canvas.height = turned ? width : height;
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Could not edit this image.')); return; }
      context.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%)${edit.grayscale ? ' grayscale(100%)' : ''}`;
      context.translate(canvas.width / 2, canvas.height / 2); context.rotate((edit.rotation * Math.PI) / 180);
      context.drawImage(image, x, y, width, height, -width / 2, -height / 2, width, height);
      canvas.toBlob((blob) => blob ? resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-page-${index + 1}.jpg`, { type: 'image/jpeg' })) : reject(new Error('Could not prepare this page.')), 'image/jpeg', 0.92);
    };
    image.onerror = () => reject(new Error('Could not read this image.')); image.src = URL.createObjectURL(file);
  });

  const savePages = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const editedFiles = await Promise.all(files.map((file, index) => renderEditedFile(file, edits[index], index)));
      let outputFiles = editedFiles;
      if (format === 'pdf') {
        const pdf = await PDFDocument.create();
        for (const file of editedFiles) { const image = await pdf.embedJpg(new Uint8Array(await file.arrayBuffer())); const page = pdf.addPage([image.width, image.height]); page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height }); }
        outputFiles = [new File([await pdf.save()], `Scanned-${new Date().toISOString().slice(0, 10)}.pdf`, { type: 'application/pdf' })];
      }
      await onUpload(outputFiles, destination); onClose();
    } finally { setBusy(false); }
  };

  const selectedEdit = edits[selectedPage] ?? defaultEdit();
  return <div className="capture-backdrop" onMouseDown={onClose}><div className={`capture-modal capture-stage-${stage}`} onMouseDown={(event) => event.stopPropagation()}>
    <div className="capture-header"><div><span className="capture-kicker">{stage === 'camera' ? 'Document scanner' : stage === 'edit' ? 'Edit document' : 'Mobile capture'}</span><h2>{stage === 'camera' ? `${files.length} page${files.length === 1 ? '' : 's'} captured` : stage === 'edit' ? 'Review and edit pages' : 'Add to Drive'}</h2></div><button className="capture-close" onClick={() => { stopCamera(); onClose(); }} title="Close"><X size={20} /></button></div>
    {stage === 'start' && <div className="capture-start"><div className="capture-hero-icon"><ScanLine size={30} /></div><h3>Capture documents or photos</h3><p>Keep the scanner open, capture pages one by one, edit them, then save the complete document.</p><div className="capture-choice-grid"><button onClick={startCamera}><Camera size={22} /><strong>Scan document</strong><span>Use the live camera</span></button><button onClick={() => galleryRef.current?.click()}><ImagePlus size={22} /><strong>Choose from gallery</strong><span>Select multiple images</span></button></div></div>}
    {stage === 'camera' && <div className="camera-stage"><div className="camera-viewport">{cameraError ? <div className="camera-error"><Camera size={28} /><p>{cameraError}</p><button onClick={() => galleryRef.current?.click()}>Choose from gallery</button></div> : <video ref={videoRef} playsInline muted />}</div><div className="camera-controls"><button onClick={() => galleryRef.current?.click()} title="Choose from gallery"><ImagePlus size={22} /></button><button className="shutter-button" onClick={capturePage} title="Capture page"><span /></button><button className="next-capture-button" disabled={!files.length} onClick={() => { stopCamera(); setStage('edit'); }} title="Next: edit document"><ArrowRight size={25} /></button></div><div className="scan-hint">{files.length ? 'Capture another page or tap Next when ready' : 'Place the page inside the frame and capture it'}</div><PageStrip files={files} selectedPage={selectedPage} onSelect={setSelectedPage} onRemove={removePage} /></div>}
    {stage === 'edit' && <div className="edit-stage"><div className="capture-preview-wrap"><div className="capture-preview-stage"><img src={URL.createObjectURL(files[selectedPage])} alt={`Page ${selectedPage + 1}`} style={{ filter: `brightness(${selectedEdit.brightness}%) contrast(${selectedEdit.contrast}%)${selectedEdit.grayscale ? ' grayscale(100%)' : ''}`, transform: `rotate(${selectedEdit.rotation}deg)` }} /></div><div className="capture-page-tools"><button onClick={() => updateEdit({ rotation: (selectedEdit.rotation + 90) % 360 })}><RotateCw size={17} /> Rotate</button><button onClick={() => updateEdit({ cropped: !selectedEdit.cropped })}>Crop</button><button onClick={() => updateEdit({ brightness: selectedEdit.brightness === 100 ? 115 : 100 })}><Sun size={17} /> Enhance</button><button onClick={() => updateEdit({ contrast: selectedEdit.contrast === 100 ? 120 : 100 })}><Contrast size={17} /> Contrast</button><button className={selectedEdit.grayscale ? 'active' : ''} onClick={() => updateEdit({ grayscale: !selectedEdit.grayscale })}>B&W</button><button onClick={() => setEdits((current) => current.map((edit, index) => applyToAll || index === selectedPage ? defaultEdit() : edit))}>Reset</button></div></div><PageStrip files={files} selectedPage={selectedPage} onSelect={setSelectedPage} onRemove={removePage} /><label className="apply-all-toggle"><input type="checkbox" checked={applyToAll} onChange={(event) => toggleApplyToAll(event.target.checked)} /><span><strong>Apply edits to all pages</strong><small>Turn this off to edit each page separately</small></span></label><button className="capture-add-page" onClick={startCamera}><ScanLine size={17} /> Scan another page</button><div className="capture-save-panel"><strong>Save document</strong><div className="capture-format"><span>Format</span><button className={format === 'pdf' ? 'active' : ''} onClick={() => setFormat('pdf')}>PDF document</button><button className={format === 'jpeg' ? 'active' : ''} onClick={() => setFormat('jpeg')}>JPEG pages</button></div><label className="capture-destination"><span><FolderOpen size={17} /> Save location</span><select value={destination ?? ''} onChange={(event) => setDestination(event.target.value || null)} disabled={loadingFolders}><option value="">My Drive</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label><div className="capture-footer"><button className="outline-button" onClick={onClose}>Discard scans</button><button className="primary-button" onClick={savePages} disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Save {format === 'pdf' ? 'PDF' : 'pages'}</button></div></div></div>}
    <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={addGalleryPages} />
  </div></div>;
}

function PageStrip({ files, selectedPage, onSelect, onRemove }: { files: File[]; selectedPage: number; onSelect: (index: number) => void; onRemove: (index: number) => void }) {
  return <div className="capture-thumbnails">{files.map((file, index) => <button key={`${file.name}-${index}`} className={index === selectedPage ? 'selected' : ''} onClick={() => onSelect(index)}><img src={URL.createObjectURL(file)} alt={`Page ${index + 1}`} /><span>{index + 1}</span><i onClick={(event) => { event.stopPropagation(); onRemove(index); }}><X size={12} /></i></button>)}</div>;
}
