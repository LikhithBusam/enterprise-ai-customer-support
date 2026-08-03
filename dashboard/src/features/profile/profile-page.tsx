import { PageHeader } from "@/components/layout/page-header"
import { ErrorState } from "@/components/status/error-state"
import { NodeInspectorSkeleton } from "@/components/status/skeletons"
import { ProfileInfoCard } from "@/features/profile/components/profile-info-card"
import { PreferencesCard } from "@/features/profile/components/preferences-card"
import { SecuritySummaryCard } from "@/features/profile/components/security-summary-card"
import { RecentActivityCard } from "@/features/profile/components/recent-activity-card"
import { useProfile } from "@/features/profile/hooks"

export function ProfilePage() {
  const profileQuery = useProfile()

  return (
    <div>
      <PageHeader title="Profile" description="Your account, preferences, and recent activity" />
      <div className="p-6">
        {profileQuery.isError ? (
          <ErrorState title="Couldn't load your profile" onRetry={() => profileQuery.refetch()} />
        ) : !profileQuery.data ? (
          <NodeInspectorSkeleton />
        ) : (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="min-w-0 space-y-6">
              <ProfileInfoCard profile={profileQuery.data} />
              <PreferencesCard preferences={profileQuery.data.preferences} />
            </div>
            <div className="min-w-0 space-y-6">
              <SecuritySummaryCard security={profileQuery.data.security} />
              <RecentActivityCard activity={profileQuery.data.recent_activity} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
