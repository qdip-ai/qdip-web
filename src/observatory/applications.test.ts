import assert from 'node:assert/strict'
import test from 'node:test'

import { findObservatoryApplicationByRoute, observableApplications } from './applications'

test('Observatory discovery exposes system applications and domain use cases from one registry', () => {
  assert.deepEqual(
    observableApplications().map(({ id, route }) => [id, route]),
    [
      ['decision-challenge', '/challenges'],
      ['decision-intake', '/decision-intake'],
      ['model-doctor', '/model-doctor'],
      ['resource-allocation', '/resource-allocation'],
      ['supply-network-optimization', '/supply-network-optimization'],
      ['contractor-allocation', '/contractor-allocation'],
      ['readiness-recovery', '/readiness-recovery'],
      ['gtm-lab', '/gtm-lab'],
    ]
  )
})

test('route lookup resolves application subroutes', () => {
  assert.equal(findObservatoryApplicationByRoute('/decision-intake/review')?.id, 'decision-intake')
  assert.equal(findObservatoryApplicationByRoute('/challenges')?.id, 'decision-challenge')
  assert.equal(findObservatoryApplicationByRoute('/model-doctor')?.id, 'model-doctor')
  assert.equal(findObservatoryApplicationByRoute('/contractor-allocation/replay')?.id, 'contractor-allocation')
  assert.equal(findObservatoryApplicationByRoute('/readiness-recovery/replay')?.id, 'readiness-recovery')
})
