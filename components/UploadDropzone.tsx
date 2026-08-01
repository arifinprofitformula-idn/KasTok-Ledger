"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";

type Props = {
  onFiles: (files: File[]) => void;
};

export default function UploadDropzone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function submitFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []).filter((file) => file.name.toLowerCase().endsWith(".xlsx"));
    if (files.length) onFiles(files);
  }

  return (
    <div
      className={`dropzone ${dragging ? "drag" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        submitFiles(event.dataTransfer.files);
      }}
    >
      <div className="dz-icon">
        <FileSpreadsheet size={24} />
      </div>
      <div className="dz-text">
        <strong>Upload laporan income TikTok Shop</strong>
        <span>Sheet yang dibaca: Riwayat penarikan. Bisa upload beberapa file `.xlsx` sekaligus.</span>
      </div>
      <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={16} />
        Pilih File
      </button>
      <input ref={inputRef} hidden type="file" accept=".xlsx" multiple onChange={(event) => submitFiles(event.target.files)} />
    </div>
  );
}
