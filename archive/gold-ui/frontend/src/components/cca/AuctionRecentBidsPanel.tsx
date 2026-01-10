import { RecentBidsActivity } from '@/components/cca/RecentBidsActivity'

export function AuctionRecentBidsPanel() {
  return (
    <div className="border-t border-white/10 pt-6">
      <RecentBidsActivity showLive={true} variant="embedded" />
    </div>
  )
}


