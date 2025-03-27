
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PDFReader from "@/components/pdf-reader";
import Image from "next/image";

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <Card className="w-full max-w-5xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold"><Image src="/logo.svg" className="inline-block" alt="Play AI Logo" width={40} height={40} /> Book Reader</CardTitle>
          <CardDescription>
            Upload a PDF and listen to it with PlayAI's Text-to-Speech
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PDFReader />
        </CardContent>
      </Card>
    </main>
  );
}