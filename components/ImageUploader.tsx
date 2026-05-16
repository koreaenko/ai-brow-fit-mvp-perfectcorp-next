"use client";

import { Camera, ImagePlus, Upload } from "lucide-react";
import { useEffect, useRef } from "react";

type ImageUploaderProps = {
  preferCamera?: boolean;
  onImageSelected: (file: File) => void;
};

export default function ImageUploader({
  preferCamera = false,
  onImageSelected,
}: ImageUploaderProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preferCamera) {
      cameraRef.current?.click();
    }
  }, [preferCamera]);

  const handleChange = (file?: File) => {
    if (file && file.type.startsWith("image/")) {
      onImageSelected(file);
    }
  };

  return (
    <section className="rounded-[24px] border border-cocoa/10 bg-white/78 p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blush/45 text-cocoa">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">사진을 올려주세요</h2>
          <p className="mt-1 text-sm leading-5 text-cocoa/62">
            정면에 가까운 사진일수록 자동 맞춤이 더 자연스럽습니다.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-cocoa text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          사진 선택
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-cocoa/15 bg-cream text-sm font-semibold text-cocoa transition active:scale-[0.98]"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          카메라
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleChange(event.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => handleChange(event.target.files?.[0])}
      />
    </section>
  );
}
