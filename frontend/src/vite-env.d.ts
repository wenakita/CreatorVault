/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CDP_API_KEY: string
  readonly VITE_BASE_RPC?: string
  readonly VITE_CDP_PAYMASTER_URL?: string
  readonly VITE_PUBLIC_SITE_MODE?: string
  readonly VITE_ADMIN_BYPASS_ADDRESSES?: string
  readonly VITE_PRIVY_APP_ID?: string
  readonly VITE_PRIVY_ENABLED?: string
  readonly VITE_PRIVY_ALLOWED_ORIGINS?: string
  readonly VITE_REGISTRY_ADDRESS: string
  readonly VITE_FACTORY_ADDRESS: string
  readonly VITE_LOTTERY_MANAGER_ADDRESS: string
  readonly VITE_AKITA_TOKEN: string
  readonly VITE_AKITA_VAULT: string
  readonly VITE_AKITA_WRAPPER: string
  readonly VITE_AKITA_SHARE_OFT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
