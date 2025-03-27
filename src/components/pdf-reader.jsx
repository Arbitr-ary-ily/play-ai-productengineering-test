"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronLeft, 
  ChevronRight, 
  Upload, 
  FileText,
  Play,
  Pause
} from "lucide-react";

export default function PDFReader() {
  const [file, setFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pageText, setPageText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPdfUrl(url);
      
      // TODO: Add PDF.js to parse the PDF and get total pages
      setTotalPages(1); // Placeholder
      setCurrentPage(1);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // TODO: Add TTS functionality
  };

  return (
    <div className="flex flex-col gap-6">
      {!file ? (
        <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg">
          <FileText className="w-12 h-12 mb-4 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium">Upload a PDF file</h3>
          <p className="mb-4 text-sm text-gray-500">
            Drag and drop or click to browse
          </p>
          <Button onClick={handleUploadClick}>
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
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevPage} disabled={currentPage <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="outline" size="icon" onClick={goToNextPage} disabled={currentPage >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant={isPlaying ? "destructive" : "default"} 
                onClick={handlePlayPause}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleUploadClick}>
                <Upload className="w-4 h-4 mr-2" />
                Change PDF
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-center h-[600px] bg-gray-100">
                <p className="text-gray-500">
                  Placeholder for PDF viewer
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}