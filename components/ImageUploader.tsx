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
    <section className="upload-surface">
      <div className="flex flex-col items-center">
        <div className="upload-symbol">
          <Upload className="h-7 w-7" aria-hidden="true" />
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
          className="studio-button studio-button-primary"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          사진 선택
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="studio-button studio-button-secondary"
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
