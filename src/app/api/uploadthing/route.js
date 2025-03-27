import { createNextRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing";

export const { GET, POST } = createNextRouteHandler({
  router: ourFileRouter,
}); 