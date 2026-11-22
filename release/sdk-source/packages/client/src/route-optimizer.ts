/** Private Route Optimizer transport contract: intentionally NOT Kernel PluginRuntime. */
import { QdipError } from './errors.js';
import type {
  RouteAddressesInput, RouteCoordinatesInput, RouteSolveResult,
} from './types.js';

const MAX_BYTES = 262_144;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const CITIES = new Set(['kyiv', 'warsaw', 'berlin']);
const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const boundedInt = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && finite(v, min, max);
const inputError = (): never => { throw new QdipError('CONFIGURATION_ERROR'); };
const responseError = (): never => { throw new QdipError('INVALID_RESPONSE'); };
const isValidId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

/** Prevent delivery addresses or route-scoped keys being sent to the public Gateway. */
export function privateRouteOrigin(raw: string, allowInsecureLoopback = false): string {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return inputError(); }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return inputError();
  const host = parsed.hostname.toLowerCase();
  const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  // Only DNS names reserved for private Docker / Railway / Kubernetes, or
  // exact RFC1918 IPv4 literals. No public hostname, even over HTTPS.
  const parts = host.split('.').map(Number);
  const rfc1918 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && parts.length === 4 &&
    parts.every(p => Number.isInteger(p) && p >= 0 && p <= 255) && (
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  const serviceDns = host === 'route-worker' ||
    host.endsWith('.railway.internal') || host.endsWith('.svc.cluster.local');
  if ((!loopback && !rfc1918 && !serviceDns) ||
      (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' &&
        (rfc1918 || serviceDns || (loopback && allowInsecureLoopback))))) return inputError();
  return parsed.origin;
}

export function serializePrivateRouteInput(
  mode: 'coordinates' | 'addresses', input: RouteCoordinatesInput | RouteAddressesInput,
): string {
  if (!isObj(input)) return inputError();
  // Runtime checks also defend JavaScript callers with structurally invalid objects.
  const data: Record<string, unknown> = input;
  if (!CITIES.has(data.city as string) ||
      !boundedInt(data.driver_count, 1, 20)) return inputError();
  if (data.max_stops_per_driver !== undefined && !boundedInt(data.max_stops_per_driver, 1, 30)) return inputError();
  if (data.max_shift_minutes !== undefined && !boundedInt(data.max_shift_minutes, 1, 480)) return inputError();
  if (data.time_limit_seconds !== undefined && !boundedInt(data.time_limit_seconds, 1, 30)) return inputError();
  if (data.include_geometry !== undefined && typeof data.include_geometry !== 'boolean') return inputError();
  if (!Array.isArray(data.deliveries) || data.deliveries.length < 1 ||
      data.deliveries.length > 600) return inputError();
  const expectedFields = mode === 'coordinates' ? ['city', 'depot', 'deliveries', 'driver_count',
    'max_stops_per_driver', 'max_shift_minutes', 'time_limit_seconds', 'include_geometry'] :
    ['city', 'depot_address', 'deliveries', 'driver_count', 'max_stops_per_driver',
      'max_shift_minutes', 'time_limit_seconds', 'include_geometry'];
  if (Object.keys(data).some(key => !expectedFields.includes(key))) return inputError();
  if (mode === 'coordinates') {
    const depot = data.depot;
    if (!isObj(depot) || Object.keys(depot).some(k => !['latitude', 'longitude'].includes(k)) ||
      !finite(depot.latitude, -90, 90) || !finite(depot.longitude, -180, 180)) return inputError();
  } else {
    if (typeof data.depot_address !== 'string' ||
        data.depot_address.length < 5 || data.depot_address.length > 240) return inputError();
  }
  const identifiers = new Set<string>();
  for (const item of data.deliveries) {
    if (!isObj(item) || !isValidId(item.id) || item.id === 'DEPOT' || identifiers.has(item.id)) return inputError();
    identifiers.add(item.id);
    if (mode === 'coordinates') {
      if (Object.keys(item).some(k => !['id', 'latitude', 'longitude'].includes(k)) ||
          !finite(item.latitude, -90, 90) || !finite(item.longitude, -180, 180)) return inputError();
    } else if (Object.keys(item).some(k => !['id', 'address'].includes(k)) ||
      typeof item.address !== 'string' || item.address.length < 5 || item.address.length > 240) {
      return inputError();
    }
  }
  try {
    const json = JSON.stringify(input);
    if (!json || new TextEncoder().encode(json).byteLength > MAX_BYTES) return inputError();
    return json;
  } catch { return inputError(); }
}

/** Fail closed on malformed solver claims; preserve additional server diagnostics. */
export function parsePrivateRouteResult(value: unknown): RouteSolveResult {
  if (!isObj(value) || !['FEASIBLE', 'PARTIAL', 'NO_SOLUTION'].includes(value.status as string) ||
      !boundedInt(value.deliveries_requested, 1, 600) ||
      !boundedInt(value.deliveries_assigned, 0, value.deliveries_requested) ||
      value.distance_basis !== 'OSRM_DRIVING_STREET_NETWORK' ||
      value.solution_quality !== 'HEURISTIC_NOT_PROVEN_OPTIMAL' ||
      value.not_safe_for_default_plugin_runtime_audit !== true ||
      typeof value.graph_id !== 'string' || !value.graph_id ||
      !Array.isArray(value.routes) || value.routes.length > 20 ||
      !Array.isArray(value.unassigned_stop_ids)) return responseError();
  const ids = new Set<string>();
  let assigned = 0;
  for (const route of value.routes) {
    if (!isObj(route) || !isValidId(route.driver_id) || !Array.isArray(route.stops) ||
        route.stops.length > 30 || route.stop_count !== route.stops.length) return responseError();
    for (const stop of route.stops) {
      if (!isObj(stop) || !isValidId(stop.id) || ids.has(stop.id) ||
          !finite(stop.latitude, -90, 90) || !finite(stop.longitude, -180, 180) ||
          !boundedInt(stop.arrival_minute, 0, 480)) return responseError();
      ids.add(stop.id);
      assigned++;
    }
  }
  if (assigned !== value.deliveries_assigned) return responseError();
  for (const id of value.unassigned_stop_ids) {
    if (!isValidId(id) || ids.has(id)) return responseError();
    ids.add(id);
  }
  if (ids.size !== value.deliveries_requested ||
      (value.status === 'FEASIBLE' && value.unassigned_stop_ids.length !== 0) ||
      (value.status === 'PARTIAL' && value.unassigned_stop_ids.length === 0) ||
      (value.status === 'NO_SOLUTION' && value.deliveries_assigned !== 0)) return responseError();
  return value as unknown as RouteSolveResult;
}
