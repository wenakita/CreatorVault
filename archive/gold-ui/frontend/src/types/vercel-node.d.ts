declare module '@vercel/node' {
  // Minimal type stubs so TypeScript tooling doesn't error in local dev builds.
  // Vercel provides the runtime types/objects in the serverless environment.
  export type VercelRequest = any
  export type VercelResponse = any
}


