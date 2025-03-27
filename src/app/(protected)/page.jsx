"use client"

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Upload } from "lucide-react";
import Link from "next/link";
import { v4 as uuidv4 } from 'uuid';
import { cn } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const uploadAreaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      const uploadId = uuidv4();
      const fileObj = {
        id: uploadId,
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        timestamp: new Date().toISOString()
      };
      const uploads = JSON.parse(localStorage.getItem('pdfUploads') || '[]');
      uploads.push(fileObj);
      localStorage.setItem('pdfUploads', JSON.stringify(uploads));
      localStorage.setItem(`pdf_${uploadId}`, URL.createObjectURL(selectedFile));
      router.push(`/upload/${uploadId}`);
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
            <Button onClick={handleUploadClick} className="bg-lime-500 text-white hover:bg-lime-600 transition-all duration-300">
              <Upload className="w-4 h-4 mr-2" />
              Select PDF
            </Button>
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          
          <div className="mt-8">
            <p className="text-sm text-gray-500">
              After uploading, you can read and listen to your PDF using <Link href="https://play.ai" target="_blank" className="text-lime-500 hover:text-lime-600 transition-all duration-300 font-medium hover:underline"><span>PlayAI's Text-to-Speech</span></Link> technology
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}