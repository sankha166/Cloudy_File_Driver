import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  Contrast,
  Crop,
  FolderOpen,
  Highlighter,
  ImagePlus,
  Loader2,
  Palette,
  PenLine,
  RotateCw,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  X,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";

export type CaptureFolder = {
  id: string;
  name: string;
  parent_id: string | null;
};
type Point = { x: number; y: number };
type PageEdit = {
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: boolean;
  crop: number;
  cropX: number;
  cropY: number;
  text: string;
  highlight: boolean;
  doodle: Point[];
};
const defaultEdit = (): PageEdit => ({
  rotation: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
  grayscale: false,
  crop: 0,
  cropX: 0.5,
  cropY: 0.5,
  text: "",
  highlight: false,
  doodle: [],
});

export function MobileCaptureModal({
  folders,
  loadingFolders,
  onLoadFolders,
  onUpload,
  onClose: closeModal,
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
  const [format, setFormat] = useState<"pdf" | "jpeg">("pdf");
  const [applyToAll, setApplyToAll] = useState(false);
  const [stage, setStage] = useState<"start" | "camera" | "edit">("start");
  const [cameraError, setCameraError] = useState("");
  const [busy, setBusy] = useState(false);
  const [doodleMode, setDoodleMode] = useState(false);
  const [activeTool, setActiveTool] = useState<
    "crop" | "adjust" | "filter" | "markup"
  >("crop");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const captureCancelledRef = useRef(false);
  const saveRequestedRef = useRef(false);
  const cropDragRef = useRef<{
    startX: number;
    startY: number;
    cropX: number;
    cropY: number;
  } | null>(null);

  useEffect(() => {
    onLoadFolders();
  }, [onLoadFolders]);
  useEffect(
    () => () => streamRef.current?.getTracks().forEach((track) => track.stop()),
    [],
  );

  const startCamera = async () => {
    setCameraError("");
    setStage("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(
        "Camera access was blocked. Choose pages from your gallery instead.",
      );
    }
  };

  const addPage = (file: File) => {
    setFiles((current) => [...current, file]);
    setEdits((current) => [...current, defaultEdit()]);
    setSelectedPage(files.length);
  };

  const capturePage = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob)
          addPage(
            new File([blob], `scan-page-${files.length + 1}.jpg`, {
              type: "image/jpeg",
            }),
          );
      },
      "image/jpeg",
      0.92,
    );
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };
  const addGalleryPages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );
    incoming.forEach(addPage);
    event.target.value = "";
    if (incoming.length) setStage("edit");
  };
  const updateEdit = (patch: Partial<PageEdit>) =>
    setEdits((current) =>
      current.map((edit, index) =>
        applyToAll || index === selectedPage ? { ...edit, ...patch } : edit,
      ),
    );
  const startCropDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== "crop" || selectedEdit.crop === 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      cropX: selectedEdit.cropX,
      cropY: selectedEdit.cropY,
    };
  };
  const moveCropDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const box = event.currentTarget.getBoundingClientRect();
    const cropSize = selectedEdit.crop / 100;
    updateEdit({
      cropX: Math.max(
        0,
        Math.min(
          1,
          drag.cropX + (event.clientX - drag.startX) / box.width / cropSize,
        ),
      ),
      cropY: Math.max(
        0,
        Math.min(
          1,
          drag.cropY + (event.clientY - drag.startY) / box.height / cropSize,
        ),
      ),
    });
  };
  const stopCropDrag = () => {
    cropDragRef.current = null;
  };
  const appendDoodle = (
    event: React.PointerEvent<HTMLDivElement>,
    start = false,
  ) => {
    if (!doodleMode || (!start && !event.buttons)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
    setEdits((current) =>
      current.map((edit, index) =>
        applyToAll || index === selectedPage
          ? { ...edit, doodle: start ? [point] : [...edit.doodle, point] }
          : edit,
      ),
    );
  };
  const toggleApplyToAll = (enabled: boolean) => {
    setApplyToAll(enabled);
    if (enabled)
      setEdits((current) =>
        current.map(() => ({ ...(current[selectedPage] ?? defaultEdit()) })),
      );
  };
  const removePage = (index: number) => {
    setFiles((current) =>
      current.filter((_, pageIndex) => pageIndex !== index),
    );
    setEdits((current) =>
      current.filter((_, pageIndex) => pageIndex !== index),
    );
    setSelectedPage((current) =>
      Math.max(0, Math.min(current, files.length - 2)),
    );
  };

  const renderEditedFile = (
    file: File,
    edit: PageEdit,
    index: number,
  ): Promise<File> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth * (1 - edit.crop / 100);
        const height = image.naturalHeight * (1 - edit.crop / 100);
        const x = (image.naturalWidth - width) * edit.cropX;
        const y = (image.naturalHeight - height) * edit.cropY;
        const turned = edit.rotation % 180 !== 0;
        const canvas = document.createElement("canvas");
        canvas.width = turned ? height : width;
        canvas.height = turned ? width : height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not edit this image."));
          return;
        }
        context.filter = `brightness(${edit.brightness}%) contrast(${edit.contrast}%) saturate(${edit.saturation}%) sepia(${edit.sepia}%)${edit.grayscale ? " grayscale(100%)" : ""}`;
        context.translate(canvas.width / 2, canvas.height / 2);
        context.rotate((edit.rotation * Math.PI) / 180);
        context.drawImage(
          image,
          x,
          y,
          width,
          height,
          -width / 2,
          -height / 2,
          width,
          height,
        );
        context.rotate((-edit.rotation * Math.PI) / 180);
        context.translate(-canvas.width / 2, -canvas.height / 2);
        if (edit.highlight) {
          context.fillStyle = "rgba(255, 226, 74, .35)";
          context.fillRect(
            canvas.width * 0.12,
            canvas.height * 0.42,
            canvas.width * 0.76,
            canvas.height * 0.12,
          );
        }
        if (edit.doodle.length > 1) {
          context.strokeStyle = "#ef4444";
          context.lineWidth = Math.max(4, canvas.width / 150);
          context.lineCap = "round";
          context.beginPath();
          edit.doodle.forEach((point, pointIndex) =>
            pointIndex
              ? context.lineTo(point.x * canvas.width, point.y * canvas.height)
              : context.moveTo(point.x * canvas.width, point.y * canvas.height),
          );
          context.stroke();
        }
        if (edit.text.trim()) {
          context.fillStyle = "#ef4444";
          context.font = `bold ${Math.max(22, Math.round(canvas.width / 18))}px sans-serif`;
          context.fillText(
            edit.text.trim(),
            canvas.width * 0.08,
            canvas.height * 0.12,
          );
        }
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(
                  new File(
                    [blob],
                    `${file.name.replace(/\.[^.]+$/, "")}-page-${index + 1}.jpg`,
                    { type: "image/jpeg" },
                  ),
                )
              : reject(new Error("Could not prepare this page.")),
          "image/jpeg",
          0.92,
        );
      };
      image.onerror = () => reject(new Error("Could not read this image."));
      image.src = URL.createObjectURL(file);
    });

  const savePages = async () => {
    if (!files.length || !saveRequestedRef.current) return;
    setBusy(true);
    try {
      const editedFiles = await Promise.all(
        files.map((file, index) => renderEditedFile(file, edits[index], index)),
      );
      let outputFiles = editedFiles;
      if (format === "pdf") {
        const pdf = await PDFDocument.create();
        for (const file of editedFiles) {
          const image = await pdf.embedJpg(
            new Uint8Array(await file.arrayBuffer()),
          );
          const page = pdf.addPage([image.width, image.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
          });
        }
        outputFiles = [
          new File(
            [await pdf.save()],
            `Scanned-${new Date().toISOString().slice(0, 10)}.pdf`,
            { type: "application/pdf" },
          ),
        ];
      }
      if (captureCancelledRef.current) return;
      await onUpload(outputFiles, destination);
      if (!captureCancelledRef.current) closeModal();
    } finally {
      setBusy(false);
    }
  };

  const discardCapture = () => {
    saveRequestedRef.current = false;
    captureCancelledRef.current = true;
    stopCamera();
    setFiles([]);
    setEdits([]);
    closeModal();
  };
  const onClose = discardCapture;

  const selectedEdit = edits[selectedPage] ?? defaultEdit();
  return (
    <div
      className="capture-backdrop"
      onMouseDown={() => {
        if (!busy) discardCapture();
      }}
    >
      <div
        className={`capture-modal capture-stage-${stage}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="capture-header">
          <div>
            <span className="capture-kicker">
              {stage === "camera"
                ? "Document scanner"
                : stage === "edit"
                  ? "Edit document"
                  : "Mobile capture"}
            </span>
            <h2>
              {stage === "camera"
                ? `${files.length} page${files.length === 1 ? "" : "s"} captured`
                : stage === "edit"
                  ? "Review and edit pages"
                  : "Add to Drive"}
            </h2>
          </div>
          <button
            type="button"
            className="capture-close"
            disabled={busy}
            onClick={discardCapture}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
        {stage === "start" && (
          <div className="capture-start">
            <div className="capture-hero-icon">
              <ScanLine size={30} />
            </div>
            <h3>Capture documents or photos</h3>
            <p>
              Keep the scanner open, capture pages one by one, edit them, then
              save the complete document.
            </p>
            <div className="capture-choice-grid">
              <button onClick={startCamera}>
                <Camera size={22} />
                <strong>Scan document</strong>
                <span>Use the live camera</span>
              </button>
              <button onClick={() => galleryRef.current?.click()}>
                <ImagePlus size={22} />
                <strong>Choose from gallery</strong>
                <span>Select multiple images</span>
              </button>
            </div>
          </div>
        )}
        {stage === "camera" && (
          <div className="camera-stage">
            <div className="camera-viewport">
              {cameraError ? (
                <div className="camera-error">
                  <Camera size={28} />
                  <p>{cameraError}</p>
                  <button onClick={() => galleryRef.current?.click()}>
                    Choose from gallery
                  </button>
                </div>
              ) : (
                <video ref={videoRef} playsInline muted />
              )}
            </div>
            <div className="camera-controls">
              <button
                onClick={() => galleryRef.current?.click()}
                title="Choose from gallery"
              >
                <ImagePlus size={22} />
              </button>
              <button
                className="shutter-button"
                onClick={capturePage}
                title="Capture page"
              >
                <span />
              </button>
              <button
                className="next-capture-button"
                disabled={!files.length}
                onClick={() => {
                  stopCamera();
                  setStage("edit");
                }}
                title="Next: edit document"
              >
                <ArrowRight size={25} />
              </button>
            </div>
            <div className="scan-hint">
              {files.length
                ? "Capture another page or tap Next when ready"
                : "Place the page inside the frame and capture it"}
            </div>
            <PageStrip
              files={files}
              selectedPage={selectedPage}
              onSelect={setSelectedPage}
              onRemove={removePage}
            />
          </div>
        )}
        {stage === "edit" && (
          <div className="edit-stage">
            <div className="capture-preview-wrap">
              <div className="capture-preview-stage">
                <div
                  className={`edited-page-preview ${doodleMode ? "doodle-mode" : ""}`}
                  onPointerDown={doodleMode ? (e) => appendDoodle(e, true) : startCropDrag}
                  onPointerMove={doodleMode ? appendDoodle : moveCropDrag}
                  onPointerUp={stopCropDrag}
                  onPointerCancel={stopCropDrag}
                  style={{
                    transform: `rotate(${selectedEdit.rotation}deg)`,
                  }}
                >
                  <img
                    src={URL.createObjectURL(files[selectedPage])}
                    alt={`Page ${selectedPage + 1}`}
                    style={{
                      filter: `brightness(${selectedEdit.brightness}%) contrast(${selectedEdit.contrast}%) saturate(${selectedEdit.saturation}%) sepia(${selectedEdit.sepia}%)${selectedEdit.grayscale ? " grayscale(100%)" : ""}`,
                    }}
                  />
                  {activeTool === "crop" && (
                    <span
                      className="crop-frame"
                      style={{
                        left: `${selectedEdit.cropX * selectedEdit.crop}%`,
                        right: `${(1 - selectedEdit.cropX) * selectedEdit.crop}%`,
                        top: `${selectedEdit.cropY * selectedEdit.crop}%`,
                        bottom: `${(1 - selectedEdit.cropY) * selectedEdit.crop}%`,
                      }}
                    />
                  )}
                  {selectedEdit.highlight && (
                    <span className="preview-highlight" />
                  )}
                  {selectedEdit.text && (
                    <strong className="preview-text">
                      {selectedEdit.text}
                    </strong>
                  )}
                  {selectedEdit.doodle.length > 1 && (
                    <svg
                      className="doodle-canvas"
                      viewBox="0 0 1 1"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        points={selectedEdit.doodle
                          .map((point) => `${point.x},${point.y}`)
                          .join(" ")}
                      />
                    </svg>
                  )}
                </div>
              </div>
            </div>
            <div className="editor-tool-tabs">
              <button
                className={activeTool === "crop" ? "active" : ""}
                onClick={() => setActiveTool("crop")}
              >
                <Crop size={17} />
                Crop
              </button>
              <button
                className={activeTool === "adjust" ? "active" : ""}
                onClick={() => setActiveTool("adjust")}
              >
                <SlidersHorizontal size={17} />
                Adjust
              </button>
              <button
                className={activeTool === "filter" ? "active" : ""}
                onClick={() => setActiveTool("filter")}
              >
                <Sparkles size={17} />
                Filters
              </button>
              <button
                className={activeTool === "markup" ? "active" : ""}
                onClick={() => setActiveTool("markup")}
              >
                <PenLine size={17} />
                Markup
              </button>
            </div>
            {activeTool === "crop" && (
              <div className="editor-panel">
                <div className="editor-panel-title">
                  <strong>Crop & straighten</strong>
                  <button
                    onClick={() =>
                      updateEdit({
                        rotation: (selectedEdit.rotation + 90) % 360,
                      })
                    }
                  >
                    <RotateCw size={16} /> Rotate
                  </button>
                </div>
                <label>
                  Zoom
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={selectedEdit.crop}
                    onChange={(e) =>
                      updateEdit({ crop: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Horizontal
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={selectedEdit.cropX}
                    onChange={(e) =>
                      updateEdit({ cropX: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Vertical
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={selectedEdit.cropY}
                    onChange={(e) =>
                      updateEdit({ cropY: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            )}
            {activeTool === "adjust" && (
              <div className="editor-panel">
                <label>
                  Brightness
                  <input
                    type="range"
                    min="60"
                    max="150"
                    value={selectedEdit.brightness}
                    onChange={(e) =>
                      updateEdit({ brightness: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Contrast
                  <input
                    type="range"
                    min="60"
                    max="150"
                    value={selectedEdit.contrast}
                    onChange={(e) =>
                      updateEdit({ contrast: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Colour
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={selectedEdit.saturation}
                    onChange={(e) =>
                      updateEdit({ saturation: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            )}
            {activeTool === "filter" && (
              <div className="filter-presets">
                <button
                  onClick={() =>
                    updateEdit({
                      brightness: 100,
                      contrast: 100,
                      saturation: 100,
                      sepia: 0,
                      grayscale: false,
                    })
                  }
                >
                  Original
                </button>
                <button
                  onClick={() =>
                    updateEdit({
                      brightness: 112,
                      contrast: 112,
                      saturation: 108,
                      sepia: 0,
                      grayscale: false,
                    })
                  }
                >
                  Enhance
                </button>
                <button
                  onClick={() =>
                    updateEdit({
                      brightness: 105,
                      contrast: 108,
                      saturation: 90,
                      sepia: 34,
                      grayscale: false,
                    })
                  }
                >
                  Warm
                </button>
                <button
                  onClick={() =>
                    updateEdit({ grayscale: !selectedEdit.grayscale })
                  }
                >
                  B&W
                </button>
              </div>
            )}
            {activeTool === "markup" && (
              <div className="editor-panel markup-panel">
                <button
                  className={selectedEdit.highlight ? "active" : ""}
                  onClick={() =>
                    updateEdit({ highlight: !selectedEdit.highlight })
                  }
                >
                  <Highlighter size={16} /> Highlight
                </button>
                <button
                  className={doodleMode ? "active" : ""}
                  onClick={() => setDoodleMode((active) => !active)}
                >
                  <PenLine size={16} /> Draw
                </button>
                <label>
                  <Type size={16} />
                  <input
                    value={selectedEdit.text}
                    maxLength={60}
                    onChange={(e) => updateEdit({ text: e.target.value })}
                    placeholder="Add text"
                  />
                </label>
                <button
                  onClick={() =>
                    updateEdit({ doodle: [], text: "", highlight: false })
                  }
                >
                  Clear markup
                </button>
              </div>
            )}
            <button
              className="editor-reset"
              onClick={() =>
                setEdits((current) =>
                  current.map((edit, index) =>
                    applyToAll || index === selectedPage ? defaultEdit() : edit,
                  ),
                )
              }
            >
              Reset this edit
            </button>
            <PageStrip
              files={files}
              selectedPage={selectedPage}
              onSelect={setSelectedPage}
              onRemove={removePage}
            />
            <label className="apply-all-toggle">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(event) => toggleApplyToAll(event.target.checked)}
              />
              <span>
                <strong>Apply edits to all pages</strong>
                <small>Turn this off to edit each page separately</small>
              </span>
            </label>
            <button className="capture-add-page" onClick={startCamera}>
              <ScanLine size={17} /> Scan another page
            </button>
            <div className="capture-save-panel">
              <strong>Save document</strong>
              <div className="capture-format">
                <span>Format</span>
                <button
                  className={format === "pdf" ? "active" : ""}
                  onClick={() => setFormat("pdf")}
                >
                  PDF document
                </button>
                <button
                  className={format === "jpeg" ? "active" : ""}
                  onClick={() => setFormat("jpeg")}
                >
                  JPEG pages
                </button>
              </div>
              <label className="capture-destination">
                <span>
                  <FolderOpen size={17} /> Save location
                </span>
                <select
                  value={destination ?? ""}
                  onChange={(event) =>
                    setDestination(event.target.value || null)
                  }
                  disabled={loadingFolders}
                >
                  <option value="">My Drive</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="capture-footer">
                <button type="button" className="outline-button" onClick={onClose} disabled={busy}>
                  Discard scans
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => { saveRequestedRef.current = true; void savePages(); }}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Check size={16} />
                  )}{" "}
                  Save {format === "pdf" ? "PDF" : "pages"}
                </button>
              </div>
            </div>
          </div>
        )}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={addGalleryPages}
        />
      </div>
    </div>
  );
}

function PageStrip({
  files,
  selectedPage,
  onSelect,
  onRemove,
}: {
  files: File[];
  selectedPage: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="capture-thumbnails">
      {files.map((file, index) => (
        <button
          key={`${file.name}-${index}`}
          className={index === selectedPage ? "selected" : ""}
          onClick={() => onSelect(index)}
        >
          <img src={URL.createObjectURL(file)} alt={`Page ${index + 1}`} />
          <span>{index + 1}</span>
          <i
            onClick={(event) => {
              event.stopPropagation();
              onRemove(index);
            }}
          >
            <X size={12} />
          </i>
        </button>
      ))}
    </div>
  );
}
