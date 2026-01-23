import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../server/auth/_shared.js'
import { getDb } from '../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints } from '../../server/_lib/waitlistPoints.js'

type TaskKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'

const TASK_POINTS: Record<TaskKey, number> = {
  shareX: 10,
  copyLink: 5,
  share: 7,
  follow: 4,
  saveApp: 6,
}

type Body = { email?: string; taskKey?: string }

type TaskClaimResponse = { email: string; taskKey: TaskKey; awarded: boolean }

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const taskKeyRaw = typeof body?.taskKey === 'string' ? body.taskKey : ''
  const taskKey = (Object.keys(TASK_POINTS) as TaskKey[]).includes(taskKeyRaw as TaskKey) ? (taskKeyRaw as TaskKey) : null
  if (!taskKey) {
    return res.status(400).json({ success: false, error: 'Invalid task key' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const me = await db.sql`
    SELECT id
    FROM waitlist_signups
    WHERE email = ${email}
    LIMIT 1;
  `
  const signupId = typeof me?.rows?.[0]?.id === 'number' ? (me.rows[0].id as number) : null
  if (!signupId) {
    const data: TaskClaimResponse = { email, taskKey, awarded: false }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<TaskClaimResponse>)
  }

  await awardWaitlistPoints({
    db,
    signupId,
    source: 'task',
    sourceId: taskKey,
    amount: TASK_POINTS[taskKey],
  })

  const data: TaskClaimResponse = { email, taskKey, awarded: true }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<TaskClaimResponse>)
}

