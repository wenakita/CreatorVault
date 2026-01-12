import { DeployStrategies } from '@/components/DeployStrategies'
import { AKITA } from '@/config/contracts'

export function AdminDeployStrategies() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deploy Strategies (Admin)</h1>
        <p className="text-sm text-gray-400">
          Deploy Charm + Ajna strategies for the AKITA vault, then add them to the vault allocation.
        </p>
      </div>

      <DeployStrategies vaultAddress={AKITA.vault} tokenAddress={AKITA.token} />
    </div>
  )
}

