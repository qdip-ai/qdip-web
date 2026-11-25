import { createHash, randomUUID } from 'node:crypto'
import { connect } from 'node:tls'
import { z } from 'zod'

export const decisionLeadSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    organization: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(254),
    decision: z.string().trim().min(10).max(4000),
    information: z.string().trim().max(3000).default(''),
    alternatives: z.string().trim().max(3000).default(''),
    constraints: z.string().trim().max(3000).default(''),
    context: z.string().trim().max(4000).default(''),
    locale: z.enum(['en', 'uk', 'pl']),
    website: z.string().max(0).default(''),
  })
  .strict()
export type DecisionLead = z.infer<typeof decisionLeadSchema>
export interface MailDelivery {
  sendDecisionLead(lead: DecisionLead, submissionId: string): Promise<void>
}
export interface SmtpTransport {
  send(
    message: string,
    config: { host: string; port: number; user: string; password: string; from: string; to: string }
  ): Promise<void>
}
function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}
function encodeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}
function html(value: string) {
  return value
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
    .replace(/\n/g, '<br>')
}

export class NodeTlsSmtpTransport implements SmtpTransport {
  async send(
    message: string,
    config: { host: string; port: number; user: string; password: string; from: string; to: string }
  ) {
    await new Promise<void>((resolve, reject) => {
      const socket = connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: true,
      })
      let buffer = '',
        step = 0,
        settled = false
      const fail = (error: unknown) => {
        if (settled) return
        settled = true
        socket.destroy()
        reject(error instanceof Error ? error : new Error('smtp_delivery_failed'))
      }
      const write = (line: string) => socket.write(`${line}\r\n`)
      const advance = (code: number) => {
        try {
          if (step === 0) {
            if (code !== 220) throw new Error('smtp_connect_failed')
            write(`EHLO qdip.ai`)
            step = 1
            return
          }
          if (step === 1) {
            if (code !== 250) throw new Error('smtp_ehlo_failed')
            write('AUTH LOGIN')
            step = 2
            return
          }
          if (step === 2) {
            if (code !== 334) throw new Error('smtp_auth_failed')
            write(Buffer.from(config.user).toString('base64'))
            step = 3
            return
          }
          if (step === 3) {
            if (code !== 334) throw new Error('smtp_auth_failed')
            write(Buffer.from(config.password).toString('base64'))
            step = 4
            return
          }
          if (step === 4) {
            if (code !== 235) throw new Error('smtp_auth_failed')
            write(`MAIL FROM:<${config.from}>`)
            step = 5
            return
          }
          if (step === 5) {
            if (code !== 250) throw new Error('smtp_sender_rejected')
            write(`RCPT TO:<${config.to}>`)
            step = 6
            return
          }
          if (step === 6) {
            if (code !== 250 && code !== 251) throw new Error('smtp_recipient_rejected')
            write('DATA')
            step = 7
            return
          }
          if (step === 7) {
            if (code !== 354) throw new Error('smtp_data_rejected')
            socket.write(`${message.replace(/(^|\r\n)\./g, '$1..')}\r\n.\r\n`)
            step = 8
            return
          }
          if (step === 8) {
            if (code !== 250) throw new Error('smtp_delivery_failed')
            write('QUIT')
            step = 9
            return
          }
          if (step === 9) {
            if (code !== 221) throw new Error('smtp_quit_failed')
            settled = true
            socket.end()
            resolve()
          }
        } catch (error) {
          fail(error)
        }
      }
      socket.setTimeout(15_000, () => fail(new Error('smtp_timeout')))
      socket.on('error', fail)
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
        let end
        while ((end = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (!/^\d{3}[ -]/.test(line)) continue
          if (line[3] === '-') continue
          advance(Number(line.slice(0, 3)))
        }
      })
    })
  }
}

export class ZohoMailDelivery implements MailDelivery {
  constructor(private readonly transport: SmtpTransport = new NodeTlsSmtpTransport()) {}
  async sendDecisionLead(lead: DecisionLead, submissionId: string) {
    const user = required('ZOHO_SMTP_USER'),
      password = required('ZOHO_SMTP_PASSWORD'),
      to = user,
      host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com',
      port = Number(process.env.ZOHO_SMTP_PORT || 465)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('smtp_config_invalid')
    const rows: [[string, string], ...Array<[string, string]>] = [
      ['Name', lead.name],
      ['Organization', lead.organization],
      ['Email', lead.email],
      ['Recurring decision', lead.decision],
      ['Information used', lead.information],
      ['Alternatives', lead.alternatives],
      ['Constraints', lead.constraints],
      ['Additional context', lead.context],
      ['Submitted', new Date().toISOString()],
      ['Locale', lead.locale],
      ['Submission ID', submissionId],
    ]
    const text = ['New QDIP decision inquiry', '', ...rows.map(([k, v]) => `${k}:\n${v || '—'}`)].join('\n\n'),
      bodyHtml = `<h2>New QDIP decision inquiry</h2>${rows.map(([k, v]) => `<p><strong>${html(k)}</strong><br>${html(v || '—')}</p>`).join('')}`,
      boundary = `qdip-${submissionId}`
    const message = [
      `From: QDIP <${encodeHeader(user)}>`,
      `To: ${encodeHeader(to)}`,
      `Reply-To: ${encodeHeader(lead.email)}`,
      `Subject: ${encodeHeader(`QDIP decision inquiry — ${lead.organization}`)}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary=\"${boundary}\"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      text,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      bodyHtml,
      `--${boundary}--`,
    ].join('\r\n')
    await this.transport.send(message, { host, port, user, password, from: user, to })
  }
}
const windows = new Map<string, { count: number; reset: number }>(),
  replays = new Map<string, { receipt: Promise<string>; expires: number }>()
export function allowSubmission(key: string, now = Date.now()) {
  const current = windows.get(key)
  if (!current || current.reset <= now) {
    windows.set(key, { count: 1, reset: now + 10 * 60_000 })
    return true
  }
  if (current.count >= 5) return false
  current.count++
  return true
}
/** Coalesce identical in-flight deliveries and retain only confirmed receipts for five minutes. */
export async function deliverDecisionLead(lead: DecisionLead, delivery: MailDelivery, id: string) {
  const now = Date.now()
  for (const [key, entry] of replays) {
    if (entry.expires <= now) replays.delete(key)
  }
  const key = createHash('sha256')
    .update(JSON.stringify({ ...lead, email: lead.email.toLowerCase() }))
    .digest('hex')
  const seen = replays.get(key)
  if (seen) return { id: await seen.receipt, duplicate: true }

  const entry = {
    receipt: Promise.resolve().then(async () => {
      await delivery.sendDecisionLead(lead, id)
      return id
    }),
    expires: Infinity,
  }
  replays.set(key, entry)
  try {
    const receipt = await entry.receipt
    entry.expires = Date.now() + 5 * 60_000
    return { id: receipt, duplicate: false }
  } catch (error) {
    replays.delete(key)
    throw error
  }
}
export function submissionId() {
  return randomUUID()
}
