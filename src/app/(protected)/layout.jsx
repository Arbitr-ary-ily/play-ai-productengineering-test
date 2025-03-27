
"use client"

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

export default function ProtectedLayout({ children }) {
  return (
    <div>
      <SidebarProvider>
        <div className="flex w-full min-h-screen">
          <AppSidebar />
          <main className="bg-gray-50 flex-1">
            <SidebarTrigger className="absolute top-2 ml-2 w-8 rounded-lg p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-900" />
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}