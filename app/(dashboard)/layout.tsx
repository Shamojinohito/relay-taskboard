import Sidebar from '@/components/layout/sidebar'
import TopBar from '@/components/layout/topbar'
import TaskDndProvider from '@/components/dnd/task-dnd-provider'
import { QueryProvider } from '@/components/query-provider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <TaskDndProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar className="hidden md:flex" dndEnabled />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </TaskDndProvider>
    </QueryProvider>
  )
}
