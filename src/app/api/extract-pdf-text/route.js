import { NextResponse } from "next/server";
import PDFParser from "pdf2json";

/**
 * Extract text from a PDF buffer
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @param {number|null} pageNum - Optional page number to extract (1-based)
 * @returns {Promise<Object>} - The extracted text
 */
async function extractTextFromPDF(pdfBuffer, pageNum = null) {
  try {
    console.log(`Extracting text from PDF${pageNum ? ` for page ${pageNum}` : ''}`);
    
    // Create a new PDF parser
    const pdfParser = new PDFParser(null, 1);
    
    // Create a promise to handle the parsing
    const parsingPromise = new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData) => {
        console.error("PDF parsing error:", errData.parserError);
        reject(errData.parserError);
      });
      
      pdfParser.on("pdfParser_dataReady", () => {
        try {
          const allText = pdfParser.getRawTextContent();
          const totalPages = pdfParser.data.Pages ? pdfParser.data.Pages.length : 0;
          
          console.log(`PDF parsed successfully. Total pages: ${totalPages}`);
          
          if (totalPages === 0) {
            reject(new Error("No pages found in PDF"));
            return;
          }
          
          // Split text by form feed character (page break)
          const pages = allText.split('\f').map(page => page.trim());
          
          console.log(`Text split into ${pages.length} pages`);
          
          if (pageNum !== null) {
            if (pageNum > 0 && pageNum <= totalPages) {
              const pageIndex = pageNum - 1;
              let pageText = "";
              
              if (pageIndex < pages.length) {
                pageText = pages[pageIndex];
              } else if (pdfParser.data.Pages && pdfParser.data.Pages[pageIndex]) {
                pageText = extractTextFromPageData(pdfParser.data.Pages[pageIndex]);
              }
              
              if (!pageText || pageText.trim() === '') {
                console.warn(`No text found on page ${pageNum}`);
              } else {
                console.log(`Extracted ${pageText.length} chars from page ${pageNum}`);
              }
              
              resolve({
                text: pageText,
                pageNum,
                totalPages
              });
            } else {
              reject(new Error(`Page ${pageNum} not found (total pages: ${totalPages})`));
            }
          } else {
            // Return all pages
            console.log(`Returning all ${pages.length} pages of text`);
            resolve({
              pages,
              totalPages
            });
          }
        } catch (error) {
          console.error("Error processing PDF data:", error);
          reject(error);
        }
      });
    });
    
    // Load PDF from buffer directly
    console.log("Parsing PDF buffer...");
    pdfParser.parseBuffer(pdfBuffer);
    
    return await parsingPromise;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw error;
  }
}

/**
 * Extract text directly from a PDF.js page data object
 * @param {Object} pageData - The page data object
 * @returns {string} - The extracted text
 */
function extractTextFromPageData(pageData) {
  let text = "";
  if (pageData && pageData.Texts) {
    for (const textItem of pageData.Texts) {
      if (textItem && textItem.R) {
        for (const r of textItem.R) {
          if (r && r.T) {
            text += decodeURIComponent(r.T) + " ";
          }
        }
      }
    }
  }
  return text.trim();
}

/**
 * API route handler for PDF text extraction
 */
export async function POST(req) {
  try {
    console.log("PDF text extraction API called");
    
    // Get the PDF file from the request
    const formData = await req.formData();
    const pdfFile = formData.get('pdf');
    const pageNumStr = formData.get('pageNum');
    
    if (!pdfFile) {
      console.error("No PDF file provided");
      return new Response(JSON.stringify(
        { error: "No PDF file provided" }
      ), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Received PDF file: ${pdfFile.name}, size: ${pdfFile.size} bytes`);
    
    if (pageNumStr) {
      console.log(`Requested page: ${pageNumStr}`);
    }
    
    // Convert the file to a buffer
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    
    // Extract text from the PDF
    const pageNum = pageNumStr ? parseInt(pageNumStr, 10) : null;
    const result = await extractTextFromPDF(pdfBuffer, pageNum);
    
    console.log("PDF extraction successful, returning result");
    
    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in PDF text extraction:', error);
    return new Response(JSON.stringify(
      { error: error.message || "An error occurred during processing" }
    ), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 