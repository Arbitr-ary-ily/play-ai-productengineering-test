import { createRouteHandler } from "uploadthing/next"; // Updated import
import { UTApi } from "uploadthing/server";
import { ourFileRouter } from "@/lib/uploadthing";

// Export the UploadThing API endpoints
export const { GET, POST } = createRouteHandler({ 
  router: ourFileRouter,
});

// Create an instance
export const utapi = new UTApi(); 