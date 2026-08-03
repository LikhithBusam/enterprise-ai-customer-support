import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function StatCardSkeleton() {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-2 px-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-16" />
      </CardContent>
    </Card>
  )
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-2 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((__, colIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return <Skeleton className="h-64 w-full" />
}

export function GraphSkeleton() {
  return (
    <div className="flex h-[520px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card">
      {Array.from({ length: 4 }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <Skeleton key={index} className="h-14 w-44 rounded-lg" />
      ))}
    </div>
  )
}

export function TimelineSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  )
}

export function NodeInspectorSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="space-y-2 pt-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
