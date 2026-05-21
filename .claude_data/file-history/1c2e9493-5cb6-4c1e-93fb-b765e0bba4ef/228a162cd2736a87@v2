import { useRef, useState, useEffect } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { resolveCourtImage } from "@/lib/imageUrl";

interface Props {
  value?: string | null;
  onChange: (path: string) => void;
  onClear?: () => void;
  size?: number; // pixel diameter, default 96
}

/**
 * Round avatar upload used by the coach onboarding wizard and the settings
 * page. Wraps /api/upload/amenity-photo (a generic image route) and stores
 * the relative path so the server can persist it on the coach profile.
 */
export function AvatarUpload({ value, onChange, onClear, size = 96 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Tik paveikslėliai (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Failas per didelis (maks. 8MB)");
      return;
    }
    setError(null);
    setUploading(true);
    const blobUrl = URL.createObjectURL(file);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${baseUrl}/api/upload/amenity-photo`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        URL.revokeObjectURL(blobUrl);
        throw new Error(data.error ?? "Įkėlimas nepavyko");
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(blobUrl);
      const data = await res.json();
      onChange(data.path);
    } catch (e: any) {
      setError(e.message ?? "Įkėlimas nepavyko");
      URL.revokeObjectURL(blobUrl);
    } finally {
      setUploading(false);
    }
  }

  const displaySrc = previewUrl ?? (value ? resolveCourtImage(value) : null);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className="relative rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center hover:border-primary/60 transition-colors group"
        style={{ width: size, height: size }}
        aria-label="Įkelti nuotrauką"
      >
        {displaySrc ? (
          <img src={displaySrc} alt="Profilio nuotrauka" className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-8 h-8 text-muted-foreground" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        {displaySrc && !uploading && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Camera className="w-5 h-5 text-white" />
          </div>
        )}
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium">Profilio nuotrauka</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Aiški veido nuotrauka padeda gauti daugiau užsakymų. JPEG, PNG, WebP · maks. 8MB.
        </p>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        {displaySrc && !uploading && onClear && (
          <button
            type="button"
            onClick={() => {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
              onClear();
            }}
            className="text-xs text-muted-foreground hover:text-destructive mt-1.5 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Pašalinti
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
