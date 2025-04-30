"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, X, FileIcon, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
}

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleFiles = useCallback((droppedFiles: File[]) => {
    const newFiles: UploadedFile[] = droppedFiles
      .filter(file => file.type === 'application/pdf')
      .map(file => ({
        file,
        status: "pending"
      }));

    if (newFiles.length !== droppedFiles.length) {
      toast.warning("Only PDF files are supported. Non-PDF files were ignored.");
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  }, [handleFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
    // Reset input value to allow uploading the same file again
    e.target.value = ""; 
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const handleSubmit = async () => {
    // Capture the indices of files being uploaded in this batch
    const indicesToUpload = files
      .map((f, index) => (f.status === 'pending' || f.status === 'error') ? index : -1)
      .filter(index => index !== -1);

    if (indicesToUpload.length === 0) {
      toast.info("No new files to upload.");
      return;
    }

    const formData = new FormData();
    indicesToUpload.forEach(index => {
      // Ensure file exists at the index before appending
      if (files[index]) {
        formData.append('files', files[index].file);
      }
    });

    // Check if formData actually has files after filtering potentially removed ones
    if (!formData.has('files')) {
        toast.warning("No valid files selected for upload.");
        return;
    }

    // Update status to uploading for visual feedback using indices
    setFiles(currentFiles =>
      currentFiles.map((f, index) =>
        indicesToUpload.includes(index) ? { ...f, status: 'uploading', progress: 0, error: undefined } : f
      )
    );

    try {
      const response = await fetch('/api/files/upload-rag', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        // Use detailed error from backend if available
        const errorDetail = result.message || result.error || 'Upload failed on server';
        throw new Error(errorDetail);
      }

      toast.success(result.message || `Successfully uploaded ${result.uploadedFiles?.length || indicesToUpload.length} file(s).`);
      
      // Update status to success using indices
      setFiles(currentFiles =>
        currentFiles.map((f, index) =>
          indicesToUpload.includes(index) ? { ...f, status: 'success', progress: 100 } : f
        )
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Upload failed: ${errorMessage}`);
      
      // Update status to error using indices
      setFiles(currentFiles =>
        currentFiles.map((f, index) =>
          indicesToUpload.includes(index) ? { ...f, status: 'error', error: errorMessage } : f
        )
      );
    }
  };

  // Re-calculate these based on the current files state
  const isUploading = files.some(f => f.status === 'uploading');
  const hasPendingOrError = files.some(f => f.status === 'pending' || f.status === 'error');
  const buttonLabel = isUploading ? 'Uploading...' : (hasPendingOrError ? 'Upload Remaining' : 'Upload Files');

  return (
    <div className="space-y-6">
      {/* Dropzone Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center relative transition-colors duration-200 ${ 
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50" 
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          id="file-upload-input"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
          onChange={handleFileChange}
          accept="application/pdf"
          disabled={isUploading} // Disable input while uploading
        />
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: isDragging ? 1.05 : 1 }}
          className="flex flex-col items-center justify-center gap-4 pointer-events-none" // Prevent inner elements blocking drop
        >
          <div className={`rounded-full p-4 ${isUploading ? 'bg-muted' : 'bg-primary/10'}`}>
            <Upload className={`h-8 w-8 ${isUploading ? 'text-muted-foreground' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Drag & Drop PDF Files</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isUploading ? 'Processing upload...' : 'or click anywhere in this area to browse'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* File List Area */} 
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Files Queue</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {files.map((uploadedFile, index) => (
              <Card 
                key={`${uploadedFile.file.lastModified}-${uploadedFile.file.name}-${index}`}
                className={`overflow-hidden transition-opacity duration-300 ${uploadedFile.status === 'uploading' ? 'opacity-70' : 'opacity-100'}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  {/* File Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-6 w-6 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={uploadedFile.file.name}>{uploadedFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                      {/* Progress/Error */}
                      {(uploadedFile.status === 'uploading' || uploadedFile.status === 'success') && uploadedFile.progress !== undefined && (
                        <Progress value={uploadedFile.progress} className="h-1 mt-1" aria-label="Upload progress" />
                      )}
                      {uploadedFile.status === 'error' && (
                        <p className="text-xs text-destructive mt-1 truncate" title={uploadedFile.error}>Error: {uploadedFile.error}</p>
                      )}
                    </div>
                  </div>
                  {/* Status Icon & Remove Button */} 
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {uploadedFile.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Uploading"/>}
                    {uploadedFile.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" aria-label="Success" />}
                    {uploadedFile.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" aria-label="Error" />}
                    {/* Allow removal only if not actively uploading or already succeeded */}
                    {(uploadedFile.status === 'pending' || uploadedFile.status === 'error') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFile(index)}
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Submit Button */} 
          <div className="flex justify-end pt-2">
            <Button 
              className="bg-[#0176d3] hover:bg-[#014486] min-w-[140px]"
              onClick={handleSubmit}
              // Disable if uploading, or if there are no pending/error files left to upload
              disabled={isUploading || !hasPendingOrError}
              aria-live="polite"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {buttonLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 