import fs from 'node:fs/promises'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined> }

type Frontmatter = {
  script?: string
  scripts?: string[]
}

export type ResolvedSkill = {
  reference: string
  name: string
  resolvedPath: string
  contents: string
  scripts: string[]
}

const SKILL_MARKDOWN = 'SKILL.md'
const FRONTMATTER_DELIM = '---'

function getRepoRoot(): string {
  return path.resolve(process.cwd())
}

function getSkillsRoot(): string {
  const env = (process.env.SKILLS_ROOT ?? '').trim()
  if (env) return path.resolve(getRepoRoot(), env)
  return path.join(getRepoRoot(), 'skills')
}

function isPathReference(reference: string): boolean {
  return reference.includes('/') || reference.includes('\\') || reference.endsWith('.md') || reference.startsWith('.')
}

function isWithinRoot(candidate: string, root: string): boolean {
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  return candidate === root || candidate.startsWith(normalizedRoot)
}

function trimQuotes(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseFrontmatter(contents: string): Frontmatter {
  if (!contents.startsWith(FRONTMATTER_DELIM)) return {}
  const endIdx = contents.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length)
  if (endIdx === -1) return {}

  const raw = contents.slice(FRONTMATTER_DELIM.length, endIdx).trim()
  const out: Frontmatter = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [rawKey, ...rest] = trimmed.split(':')
    if (!rawKey || rest.length === 0) continue
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (!value) continue
    if (key === 'script') {
      out.script = trimQuotes(value)
    }
    if (key === 'scripts') {
      const parsed = value
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((item) => trimQuotes(item))
        .filter(Boolean)
      if (parsed.length) out.scripts = parsed
    }
  }
  return out
}

function extractSkillScripts(contents: string): string[] {
  const frontmatter = parseFrontmatter(contents)
  const scripts: string[] = []
  if (frontmatter.script) scripts.push(frontmatter.script)
  if (frontmatter.scripts?.length) scripts.push(...frontmatter.scripts)
  const unique = new Set<string>()
  for (const script of scripts) {
    const trimmed = script.trim()
    if (!trimmed) continue
    unique.add(trimmed)
  }
  return Array.from(unique)
}

function deriveName(reference: string, resolvedPath: string): string {
  if (!isPathReference(reference)) return reference.trim()
  if (path.basename(resolvedPath).toLowerCase() === SKILL_MARKDOWN.toLowerCase()) {
    return path.basename(path.dirname(resolvedPath))
  }
  return path.basename(resolvedPath, path.extname(resolvedPath))
}

function resolveCandidate(reference: string, repoRoot: string): string {
  if (isPathReference(reference)) return path.resolve(repoRoot, reference)
  return path.join(getSkillsRoot(), reference, SKILL_MARKDOWN)
}

async function ensureSkillPath(reference: string): Promise<string> {
  const repoRoot = getRepoRoot()
  let candidate = resolveCandidate(reference, repoRoot)
  if (!isWithinRoot(candidate, repoRoot)) {
    throw new Error('Skill path must resolve within repository root.')
  }

  const stat = await fs
    .stat(candidate)
    .catch(() => null)
  if (stat?.isDirectory()) {
    candidate = path.join(candidate, SKILL_MARKDOWN)
  }

  if (!candidate.endsWith(SKILL_MARKDOWN)) {
    throw new Error('Skill reference must resolve to a SKILL.md file.')
  }

  const finalStat = await fs
    .stat(candidate)
    .catch(() => null)
  if (!finalStat || !finalStat.isFile()) {
    throw new Error(`Skill not found at ${candidate}`)
  }

  if (!isWithinRoot(candidate, repoRoot)) {
    throw new Error('Resolved skill path must remain within repository root.')
  }

  return candidate
}

export async function resolveSkill(reference: string): Promise<ResolvedSkill> {
  const normalized = reference.trim()
  if (!normalized) throw new Error('Skill reference is required.')

  const resolvedPath = await ensureSkillPath(normalized)
  const contents = await fs.readFile(resolvedPath, 'utf8')
  const scripts = extractSkillScripts(contents)

  console.info('[skills] resolved skill', {
    reference: normalized,
    resolvedPath,
    scripts: scripts.length,
  })

  return {
    reference: normalized,
    name: deriveName(normalized, resolvedPath),
    resolvedPath,
    contents,
    scripts,
  }
}

export function resolveSkillScriptPath(skillPath: string, scriptRef: string): string {
  const repoRoot = getRepoRoot()
  const skillDir = path.dirname(skillPath)
  const candidate = path.resolve(skillDir, scriptRef)
  if (!isWithinRoot(candidate, repoRoot)) {
    throw new Error('Skill script path must resolve within repository root.')
  }
  return candidate
}

export function getRepoRootPath(): string {
  return getRepoRoot()
}
