import { useRef, useState, useEffect } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { resolveCourtImage } from "@/lib/imageUrl";

interface CourtImageUploadProps {
  value?: string;
  onChange: (path: string) => void;
  onClear: () => void;
}

export function CourtImageUpload({ value, onChange, onClear }: CourtImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Tik paveikslėliai (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Failas per didelis (maks. 8MB)");
      return;
    }

    setError(null);
    setIsUploading(true);

    const blobUrl = URL.createObjectURL(file);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${baseUrl}/api/upload/court-image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        URL.revokeObjectURL(blobUrl);
        throw new Error(data.error ?? "Įkėlimas nepavyko");
      }

      const data = await res.json();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(blobUrl);
      onChange(data.path);
    } catch (err: any) {
      setError(err.message ?? "Įkėlimas nepavyko");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onClear();
  };

  const displaySrc = previewUrl ?? (value ? resolveCourtImage(value) : null);

  if (displaySrc && !isUploading) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-border group">
        <img
          src={displaySrc}
          alt="Aikštelės nuotrauka"
          className="w-full h-48 object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="bg-white/90 text-black text-xs font-medium px-3 py-1.5 rounded-md hover:bg-white transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Keisti
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="bg-destructive/90 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-destructive transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Ištrinti
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg h-44 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
          ${isUploading ? "cursor-not-allowed opacity-70" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Įkeliama...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                <span className="text-primary">Pasirinkite failą</span> arba vilkite čia
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, WebP · maks. 8MB</p>
            </div>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
