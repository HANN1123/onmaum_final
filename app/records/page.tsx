import WeeklyRecords from '@/features/ui/records/WeeklyRecords'
import DataManagement from '@/features/ui/records/DataManagement'

export default function RecordsPage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-ink-900">기록</h1>
          <p className="mt-2 text-sm text-ink-500">한 주 동안의 마음 기록</p>
        </header>
        <WeeklyRecords />
        <DataManagement />
      </section>
    </main>
  )
}
