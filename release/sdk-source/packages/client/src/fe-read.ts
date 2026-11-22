import { QdipError } from './errors.js';
import type { FEForecastExecutionState, FESealedForecastArtifact } from './types.js';

const record = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const digest = (x: unknown): x is string =>
  typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const identity = (x: unknown): x is string =>
  typeof x === 'string' && x.length >= 1 && x.length <= 128;

export const validForecastDomainId = (value: string): boolean =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);

export function parseFEExecutionState(
  value: unknown, domainId: string, executionId: string,
): FEForecastExecutionState {
  if (!record(value) || value.domain_id !== domainId ||
      value.execution_id !== executionId ||
      !['REQUESTED', 'MATERIALIZED', 'SEALED', 'FAILED'].includes(String(value.status)) ||
      typeof value.artifact_ready !== 'boolean' ||
      value.journal_record_present !== true ||
      !Number.isSafeInteger(value.state_version) ||
      (value.state_version as number) < 0 ||
      (value.artifact_hash !== null && !digest(value.artifact_hash)) ||
      (value.failure_code !== null &&
       (typeof value.failure_code !== 'string' ||
        value.failure_code.length < 1 || value.failure_code.length > 128)))
    throw new QdipError('INVALID_RESPONSE');
  const sealed = value.status === 'SEALED';
  if (value.artifact_ready !== sealed ||
      sealed !== digest(value.artifact_hash) ||
      (value.status === 'FAILED') !== (typeof value.failure_code === 'string') ||
      value.state_version === null)
    throw new QdipError('INVALID_RESPONSE');
  return value as unknown as FEForecastExecutionState;
}

export function parseFESealedArtifact(
  value: unknown, domainId: string, executionId: string,
): FESealedForecastArtifact {
  const sourceId = record(value) && value.execution_id;
  if (!record(value) || value.version !== 'future-engine.forecast-artifact.v1' ||
      value.domain_id !== domainId || typeof sourceId !== 'string' ||
      !/^[a-f0-9]{24}:/.test(sourceId) ||
      sourceId.slice(25) !== executionId ||
      !digest(value.artifact_hash) || !digest(value.context_hash) ||
      !digest(value.payload_hash) ||
      !identity(value.adapter_id) || !identity(value.adapter_version) ||
      !identity(value.request_schema_id) || !identity(value.request_schema_version) ||
      !identity(value.payload_schema_id) || !identity(value.payload_schema_version) ||
      !record(value.request_payload) || !record(value.payload))
    throw new QdipError('INVALID_RESPONSE');
  // SHA replay and tenant isolation are verified by the FE server registry.
  // This client validates the envelope and requested scoped identity.
  return value as unknown as FESealedForecastArtifact;
}
