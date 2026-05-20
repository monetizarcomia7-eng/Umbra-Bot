import { DocsSidebar } from './DocsSidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <DocsSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
