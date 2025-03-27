"use client"

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Upload } from "lucide-react";
import Link from "next/link";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing-client";

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const uploadAreaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const { startUpload } = useUploadThing("pdfUploader");
  const [timeOfDay, setTimeOfDay] = useState(() => {
    const hours = new Date().getHours();
    return hours < 12 ? "morning" : hours < 18 ? "afternoon" : "evening";
  });

  // listen for the focus-upload event
  useEffect(() => {
    const handleFocusUpload = () => {
      setIsFocused(true);
      setTimeout(() => {
        setIsFocused(false);
      }, 1500); 
    };

    window.addEventListener('focus-upload', handleFocusUpload);
    
    return () => {
      window.removeEventListener('focus-upload', handleFocusUpload);
    };
  }, []);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      try {
        setIsUploading(true);
        setUploadError(null);
        
        const [res] = await startUpload([selectedFile]);
        
        if (res) {
          const uploadId = uuidv4();
          const fileObj = {
            id: uploadId,
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type,
            timestamp: new Date().toISOString(),
            url: res.url
          };
          
          const uploads = JSON.parse(localStorage.getItem('pdfUploads') || '[]');
          uploads.push(fileObj);
          localStorage.setItem('pdfUploads', JSON.stringify(uploads));
          
          router.push(`/upload/${uploadId}`);
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadError('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div ref={uploadAreaRef} className="container mx-auto flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-medium text-lime-500">Good {timeOfDay}</h1>
        <p className="text-4xl mb-10">What do you want to read today?</p>
        
        <div className="max-w-2xl mx-auto">
          <div className={cn(
            "flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg transition-colors duration-500",
            isFocused ? "border-lime-500" : "border-gray-200"
          )}>
            <FileText className="w-12 h-12 mb-4 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium">Upload a PDF file</h3>
            <p className="mb-4 text-sm text-gray-500">
              Drag and drop or click to browse
            </p>
            <Button 
              onClick={handleUploadClick} 
              className="bg-lime-500 text-white hover:bg-lime-600 transition-all duration-300"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Select PDF
                </>
              )}
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {uploadError && (
              <p className="mt-2 text-sm text-red-500">
                {uploadError}
              </p>
            )}
          </div>
          
          <div className="mt-8">
            <p className="text-sm text-gray-500">
              After uploading, you can read and listen to your PDF using <Link href="https://play.ai" target="_blank" className="text-lime-500 hover:text-lime-600 transition-all duration-300 font-medium hover:underline"><span>PlayAI's TTS</span></Link> technology
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}