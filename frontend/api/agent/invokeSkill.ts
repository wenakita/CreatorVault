import type { VercelRequest, VercelResponse } from '@vercel/node'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  type ApiEnvelope,
} from '../auth/_shared.js'
import {
  getRepoRootPath,
  resolveSkill,
  resolveSkillScriptPath,
  type ResolvedSkill,
} from '../_lib/skills.js'
import { logger } from '../_lib/logger.js'

declare const process: { env: Record<string, string | undefined> }

type SkillInvokeRequest = {
  reference?: string
  execute?: boolean
  confirmed?: boolean
  scriptPath?: string
}

type SkillInvokeResponse = {
  skill: {
    name: string
    resolvedPath: string
    contents: string
    scripts: string[]
  }
  execution?: {
    scriptPath: string
    stdout: string
    stderr: string
    exitCode: number | null
  }
}

const EXECUTION_TIMEOUT_MS = 30_000
const OUTPUT_LIMIT_BYTES = 64_000

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function resolveAllowlistEntries(entries: string[], repoRoot: string): string[] {
  return entries.map((entry) => {
    if (entry === '*' || entry.toLowerCase() === 'all') return entry
    if (path.isAbsolute(entry)) return path.normalize(entry)
    return path.resolve(repoRoot, entry)
  })
}

function isScriptAllowed(scriptPath: string, allowlist: string[]): boolean {
  if (allowlist.includes('*') || allowlist.includes('all')) return true
  return allowlist.some((entry) => {
    if (entry === '*') return true
    if (entry.endsWith(path.sep)) {
      return scriptPath.startsWith(entry)
    }
    if (entry.endsWith('/*')) {
      const base = entry.slice(0, -2)
      return scriptPath.startsWith(base + path.sep)
    }
    return scriptPath === entry
  })
}

function pickScript(reference: SkillInvokeRequest, resolved: ResolvedSkill): string | null {
  if (reference.scriptPath) return reference.scriptPath
  if (resolved.scripts.length > 0) return resolved.scripts[0]
  return null
}

function getRunner(scriptPath: string): { command: string; args: string[] } {
  const ext = path.extname(scriptPath).toLowerCase()
  if (ext === '.sh') return { command: 'bash', args: [scriptPath] }
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return { command: 'node', args: [scriptPath] }
  throw new Error(`Unsupported script type: ${ext}`)
}

async function runScript(scriptPath: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const repoRoot = getRepoRootPath()
  const { command, args } = getRunner(scriptPath)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    const onChunk = (target: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      if (target === 'stdout') stdout = (stdout + text).slice(-OUTPUT_LIMIT_BYTES)
      if (target === 'stderr') stderr = (stderr + text).slice(-OUTPUT_LIMIT_BYTES)
    }

    child.stdout?.on('data', onChunk('stdout'))
    child.stderr?.on('data', onChunk('stderr'))

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Script execution timed out after ${EXECUTION_TIMEOUT_MS}ms`))
    }, EXECUTION_TIMEOUT_MS)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code })
    })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Use POST to invoke skills.' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<SkillInvokeRequest>(req)) ?? {}
  const reference = typeof body.reference === 'string' ? body.reference : ''
  if (!reference.trim()) {
    return res.status(400).json({ success: false, error: 'reference is required.' } satisfies ApiEnvelope<never>)
  }

  try {
    logger.info('[skills] invoke request', { reference, execute: body.execute ?? false })
    const resolved = await resolveSkill(reference)

    const response: SkillInvokeResponse = {
      skill: {
        name: resolved.name,
        resolvedPath: resolved.resolvedPath,
        contents: resolved.contents,
        scripts: resolved.scripts,
      },
    }

    if (body.execute) {
      if (!body.confirmed) {
        logger.warn('[skills] blocked execution: confirmation missing', { reference })
        return res.status(412).json({ success: false, error: 'Script execution requires confirmed=true.' } satisfies ApiEnvelope<never>)
      }

      const scriptRef = pickScript(body, resolved)
      if (!scriptRef) {
        return res.status(400).json({ success: false, error: 'No script reference found for skill.' } satisfies ApiEnvelope<never>)
      }

      const scriptPath = resolveSkillScriptPath(resolved.resolvedPath, scriptRef)
      const allowlistEntries = resolveAllowlistEntries(parseAllowlist(process.env.SKILL_SCRIPT_ALLOWLIST), getRepoRootPath())
      if (!isScriptAllowed(scriptPath, allowlistEntries)) {
        logger.warn('[skills] blocked execution: script not allowlisted', { reference, scriptPath })
        return res.status(403).json({ success: false, error: 'Script path is not allowlisted.' } satisfies ApiEnvelope<never>)
      }

      const stat = await fs.stat(scriptPath).catch(() => null)
      if (!stat || !stat.isFile()) {
        return res.status(400).json({ success: false, error: 'Script file not found.' } satisfies ApiEnvelope<never>)
      }

      logger.info('[skills] executing script', { reference, scriptPath })
      const result = await runScript(scriptPath)
      response.execution = { scriptPath, ...result }
    }

    return res.status(200).json({ success: true, data: response } satisfies ApiEnvelope<SkillInvokeResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve skill.'
    logger.error('[skills] invoke error', { reference, message })
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
