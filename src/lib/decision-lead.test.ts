import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allowSubmission,
  decisionLeadSchema,
  deliverDecisionLead,
  type SmtpTransport,
  ZohoMailDelivery,
} from './decision-lead'

const valid = {
  name: 'Ada Lovelace',
  organization: 'Example Org',
  email: 'ada@example.org',
  decision: 'Choose which recurring requests should receive limited resources.',
  information: 'Requests and capacity',
  alternatives: 'Fund, defer, reject',
  constraints: 'Budget',
  context: '',
  locale: 'en' as const,
  website: '',
}

test('accepts a valid decision inquiry', () => {
  assert.equal(decisionLeadSchema.parse(valid).email, 'ada@example.org')
})
test('rejects missing required fields', () => {
  assert.throws(() => decisionLeadSchema.parse({ ...valid, organization: '' }))
})
test('rejects invalid email', () => {
  assert.throws(() => decisionLeadSchema.parse({ ...valid, email: 'not-email' }))
})
test('rejects oversized input', () => {
  assert.throws(() => decisionLeadSchema.parse({ ...valid, decision: 'x'.repeat(4001) }))
})
test('rejects unexpected fields', () => {
  assert.throws(() => decisionLeadSchema.parse({ ...valid, admin: true }))
})
test('honeypot must be empty', () => {
  assert.throws(() => decisionLeadSchema.parse({ ...valid, website: 'bot' }))
})
test('rate limit rejects the sixth request in a window', () => {
  const key = `test-${Date.now()}`
  for (let i = 0; i < 5; i++) assert.equal(allowSubmission(key), true)
  assert.equal(allowSubmission(key), false)
})
test('successful duplicate returns original receipt without another delivery', async () => {
  const lead = decisionLeadSchema.parse({ ...valid, email: 'replay@example.org' })
  let sends = 0
  const delivery = {
    sendDecisionLead: async () => {
      sends++
    },
  }
  assert.deepEqual(await deliverDecisionLead(lead, delivery, 'first'), { id: 'first', duplicate: false })
  assert.deepEqual(await deliverDecisionLead(lead, delivery, 'second'), { id: 'first', duplicate: true })
  assert.equal(sends, 1)
})
test('concurrent duplicates share a single in-flight delivery', async () => {
  const lead = decisionLeadSchema.parse({ ...valid, email: 'concurrent@example.org' })
  let sends = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const delivery = {
    sendDecisionLead: async () => {
      sends++
      await pending
    },
  }
  const first = deliverDecisionLead(lead, delivery, 'first')
  const second = deliverDecisionLead(lead, delivery, 'second')
  release()
  const results = await Promise.all([first, second])
  assert.deepEqual(
    results.map((r) => r.id),
    ['first', 'first']
  )
  assert.equal(sends, 1)
})
test('failed concurrent delivery is not cached and can be retried', async () => {
  const lead = decisionLeadSchema.parse({ ...valid, email: 'retry@example.org' })
  let sends = 0
  const delivery = {
    sendDecisionLead: async () => {
      if (++sends === 1) throw new Error('smtp_delivery_failed')
    },
  }
  const failed = await Promise.allSettled([
    deliverDecisionLead(lead, delivery, 'failed'),
    deliverDecisionLead(lead, delivery, 'duplicate'),
  ])
  assert.deepEqual(
    failed.map((r) => r.status),
    ['rejected', 'rejected']
  )
  assert.deepEqual(await deliverDecisionLead(lead, delivery, 'retry'), { id: 'retry', duplicate: false })
  assert.equal(sends, 2)
})
test('changed contact or context is a new submission', async () => {
  const lead = decisionLeadSchema.parse({ ...valid, email: 'changed@example.org' })
  let sends = 0
  const delivery = {
    sendDecisionLead: async () => {
      sends++
    },
  }
  await deliverDecisionLead(lead, delivery, 'original')
  assert.equal((await deliverDecisionLead({ ...lead, context: 'New phone number' }, delivery, 'changed')).id, 'changed')
  assert.equal(sends, 2)
})

test('Zoho delivery uses SMTP mailbox as sender and recipient without sending real email', async () => {
  const old = { ...process.env }
  Object.assign(process.env, { ZOHO_SMTP_USER: 'hello@qdip.ai', ZOHO_SMTP_PASSWORD: 'app-password' })
  let captured = ''
  const transport: SmtpTransport = {
    send: async (message) => {
      captured = message
    },
  }
  try {
    await new ZohoMailDelivery(transport).sendDecisionLead(decisionLeadSchema.parse(valid), 'submission-1')
    assert.match(captured, /From: QDIP <hello@qdip\.ai>/)
    assert.match(captured, /To: hello@qdip\.ai/)
    assert.match(captured, /Reply-To: ada@example\.org/)
    assert.match(captured, /QDIP decision inquiry/)
  } finally {
    process.env = old
  }
})
test('Zoho delivery failure is surfaced without sending a real email', async () => {
  const old = { ...process.env }
  Object.assign(process.env, { ZOHO_SMTP_USER: 'hello@qdip.ai', ZOHO_SMTP_PASSWORD: 'app-password' })
  const transport: SmtpTransport = {
    send: async () => {
      throw new Error('smtp_delivery_failed')
    },
  }
  try {
    await assert.rejects(
      () => new ZohoMailDelivery(transport).sendDecisionLead(decisionLeadSchema.parse(valid), 'submission-2'),
      /smtp_delivery_failed/
    )
  } finally {
    process.env = old
  }
})
