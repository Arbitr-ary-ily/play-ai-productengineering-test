"use client";

import { generateReactHelpers } from "@uploadthing/react";
import { ourFileRouter } from "./uploadthing";

export const { useUploadThing, uploadFiles } = generateReactHelpers(ourFileRouter); 