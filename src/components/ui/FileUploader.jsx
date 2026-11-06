import React, { useState, useRef } from 'react';
import api from '../../services/api';

export default function FileUploader({
  iouId,
  directExpenseId,
  onUploaded,
  multiple = true,
  showCompletedList = false
}) {
  const [files, setFiles] = useState([]); // { file, status: 'uploading'|'done'|'error', name, result, error }
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  async function uploadFile(file) {
    const entry = {
      file,
      status: 'uploading',
      name: file.name,
      result: null,
      error: null
    };

    setFiles((s) => [...s, entry]);

    const fd = new FormData();
    fd.append('file', file);
    if (iouId) fd.append('iou_id', iouId);
    if (directExpenseId) fd.append('direct_expense_id', directExpenseId);

    try {
      const res = await api.post('/uploads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploaded = res.data;

      if (
        !uploaded ||
        typeof uploaded !== 'object' ||
        !uploaded.file_name ||
        !uploaded.blob_name ||
        !uploaded.file_path
      ) {
        console.error('Invalid upload response:', uploaded);
        throw new Error('Invalid upload response from server');
      }

      if (showCompletedList) {
        setFiles((s) =>
          s.map((f) =>
            f.file === file
              ? { ...f, status: 'done', result: uploaded, error: null }
              : f
          )
        );
      } else {
        // Remove from in-flight upload queue so it is not displayed twice
        // (the parent component displays the uploaded attachment in its list)
        setFiles((s) => s.filter((f) => f.file !== file));
      }

      if (typeof onUploaded === 'function') {
        onUploaded(uploaded);
      }
    } catch (err) {
      console.error('Upload failed:', err);

      setFiles((s) =>
        s.map((f) =>
          f.file === file
            ? {
              ...f,
              status: 'error',
              error: err?.response?.data?.message || err?.message || 'Upload failed'
            }
            : f
        )
      );
    }
  }

  function handleChange(e) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    selected.forEach((f) => uploadFile(f));

    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (!dropped.length) return;

    if (!multiple) {
      uploadFile(dropped[0]);
    } else {
      dropped.forEach((f) => uploadFile(f));
    }
  }

  function removeEntry(idx) {
    setFiles((s) => s.filter((_, i) => i !== idx));
  }

  const visibleFiles = showCompletedList
    ? files
    : files.filter((f) => f.status === 'uploading' || f.status === 'error');

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50/50'
            : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/30'
        }`}
      >
        <svg
          className="w-6 h-6 mx-auto text-slate-400 mb-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <span className="text-sm text-slate-500">
          Click to browse files{multiple ? ' (multiple allowed)' : ''}
        </span>

        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {visibleFiles.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {visibleFiles.map((f, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                f.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200 animate-pulse'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {f.status === 'uploading' && (
                  <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                {f.status === 'done' && (
                  <span className="text-emerald-500 flex-shrink-0">✓</span>
                )}
                {f.status === 'error' && (
                  <span className="text-red-500 font-bold flex-shrink-0">✕</span>
                )}

                <span className={`truncate ${f.status === 'error' ? 'text-red-700 font-medium' : 'text-slate-600'}`}>
                  {f.status === 'uploading' ? `Uploading ${f.name}...` : f.name}
                  {f.status === 'error' && f.error ? ` (${f.error})` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {f.status === 'error' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        removeEntry(idx);
                        uploadFile(f.file);
                      }}
                      className="text-blue-600 text-xs font-semibold hover:underline"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(idx)}
                      className="text-slate-400 text-xs hover:text-slate-600"
                    >
                      Dismiss
                    </button>
                  </>
                )}

                {f.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => removeEntry(idx)}
                    className="text-red-400 text-xs hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
