import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AuthGuard from "@/components/AuthGuard";
import { PapelProvider } from "@/components/PapelContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PapelProvider>
        <div className="flex h-screen overflow-hidden" style={{ background: '#f7f7f7' }}>
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-y-auto" id="main-scroll">
              {children}
            </main>
          </div>
        </div>
      </PapelProvider>
    </AuthGuard>
  )
}
