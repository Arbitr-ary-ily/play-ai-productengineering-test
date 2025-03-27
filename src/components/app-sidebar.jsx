
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  SidebarInput
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { triggerFocusUpload } from "@/lib/events"

export function AppSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [searchFilter, setSearchFilter] = useState("")
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [uploads, setUploads] = useState([])
  
  // load uploads from local storage
  useEffect(() => {
    const storedUploads = JSON.parse(localStorage.getItem('pdfUploads') || '[]');
    setUploads(storedUploads);
  }, [pathname]); // refresh when pathname changes (after new upload)

  // filter and group uploads
  const groupedUploads = useMemo(() => {
    const filtered = uploads.filter(upload =>
      upload.name.toLowerCase().includes(searchFilter.toLowerCase())
    )

    return filtered.reduce((acc, upload) => {
      const date = new Date(upload.timestamp)
      let group = "EARLIER"

      if (isToday(date)) {
        group = "TODAY"
      } else if (isYesterday(date)) {
        group = "YESTERDAY"
      }

      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(upload)
      return acc
    }, {})
  }, [uploads, searchFilter])

  const handleNewUpload = () => {
    router.push("/")
    
    setTimeout(() => {
      triggerFocusUpload()
    }, 50)
  }

  const handleUploadClick = uploadId => {
    router.push(`/upload/${uploadId}`)
  }

  return (
    <Sidebar
      className={cn(
        "fixed left-0 top-0 z-30 h-full w-[255px] border-r border-gray-200 bg-white transition-all duration-300 ease-in-out",
        "data-[state=closed]:invisible data-[state=closed]:w-0"
      )}
    >
      <div className="flex flex-col h-full">
        <SidebarHeader className="px-4 py-4">
          <div className="mb-4 flex justify-center items-center gap-2">
            <Image
              src="/logo.svg"
              alt="PlayAI logo"
              width={70}
              height={70}
            />
          </div>
          <Button
            onClick={handleNewUpload}
            size="sm"
            className="text-sm font-normal bg-lime-500 text-white hover:bg-lime-600 transition-all duration-300"
          >
            <Plus className="-ms-1 me-2 opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
            New Upload
            <kbd className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-gray-100/50 px-1 font-[inherit] text-[0.625rem] font-medium">
              ⌘N
            </kbd>
          </Button>
        </SidebarHeader>
        
        <div className="px-4 mt-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <SidebarInput
              id="search-uploads"
              placeholder="Search uploads..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full border-0 bg-white pl-9 text-sm shadow-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus-visible:ring-2"
            />
          </div>         
        </div>

        <ScrollArea className="flex-grow">
          <div className="px-2">
            {Object.entries(groupedUploads).map(([date, dateUploads]) => (
              <SidebarGroup key={date} className="mb-6 last:mb-0">
                <SidebarGroupLabel className="mb-1 px-2 text-[11px] font-medium tracking-wider text-gray-400">
                  {date}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {dateUploads.map(upload => {
                      const isActive = pathname === `/upload/${upload.id}`

                      return (
                        <SidebarMenuItem key={upload.id} className="mb-1">
                          <div className={cn(
                            "group flex w-full items-center gap-2 rounded-md text-left transition-colors cursor-pointer px-2 py-1",
                            isActive
                              ? "bg-gray-100 text-gray-900"
                              : "text-gray-600 hover:bg-gray-100"
                          )} onClick={() => handleUploadClick(upload.id)}>
                            <FileText
                              className={cn(
                                "h-4 w-4",
                                isActive ? "text-gray-500" : "text-gray-400"
                              )}
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-[13px] overflow-hidden whitespace-nowrap" style={{ maxWidth: '180px' }}>
                                {upload.name}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {format(new Date(upload.timestamp), "h:mm a")}
                              </span>
                            </div>
                          </div>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}

            {Object.keys(groupedUploads).length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <FileText className="h-5 w-5 text-gray-300" />
                <p className="text-xs text-gray-400">
                  {searchFilter ? "No matching uploads" : "No uploads yet"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </Sidebar>
  )
}