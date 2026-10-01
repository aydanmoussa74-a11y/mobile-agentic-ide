import { listFiles, readFile, type VirtualFile } from "../storage";

export const MOCK_ROUTES_PATH = ".mocks/routes.json";
export interface MockRoute { method?: string; path: string; fixture?: string; status?: number; headers?: Record<string, string>; body?: unknown; }
export interface MockRouteConfig { routes: MockRoute[]; }
export interface MockGatewaySnapshot { routes: MockRoute[]; fixtures: Record<string, unknown>; }

export async function loadMockGateway(): Promise<MockGatewaySnapshot> {
  const routeFile = await readFile(MOCK_ROUTES_PATH);
  if (!routeFile) return { routes: [], fixtures: {} };
  const parsed: unknown = JSON.parse(routeFile.content);
  if (!isRecord(parsed) || !Array.isArray(parsed.routes)) throw new Error(`${MOCK_ROUTES_PATH} must contain { "routes": [] }.`);
  const routes = parsed.routes.filter(isRoute).map((route) => ({ ...route, method: route.method?.toUpperCase() ?? "GET" }));
  const fixturePaths = [...new Set(routes.map((route) => route.fixture).filter((path): path is string => Boolean(path)))];
  const fixtures: Record<string, unknown> = {};
  for (const path of fixturePaths) { const file = await readFile(path); if (!file) throw new Error(`Mock fixture not found: ${path}`); fixtures[path] = JSON.parse(file.content); }
  return { routes, fixtures };
}

export async function buildMockScript(files?: VirtualFile[]): Promise<string> {
  const snapshot = files ? await loadMockGatewayFromFiles(files) : await loadMockGateway();
  if (!snapshot.routes.length) return "";
  const payload = JSON.stringify(snapshot).replace(/</g, "\\u003c");
  return `<script>(${installMockGateway.toString()})(${payload});</script>`;
}

async function loadMockGatewayFromFiles(files: VirtualFile[]): Promise<MockGatewaySnapshot> {
  const routeFile = files.find((file) => file.path === MOCK_ROUTES_PATH);
  if (!routeFile) return { routes: [], fixtures: {} };
  const parsed: unknown = JSON.parse(routeFile.content);
  if (!isRecord(parsed) || !Array.isArray(parsed.routes)) throw new Error(`${MOCK_ROUTES_PATH} must contain { "routes": [] }.`);
  const routes = parsed.routes.filter(isRoute).map((route) => ({ ...route, method: route.method?.toUpperCase() ?? "GET" }));
  const fixtures: Record<string, unknown> = {};
  for (const path of [...new Set(routes.map((route) => route.fixture).filter((path): path is string => Boolean(path)))]) { const file = files.find((candidate) => candidate.path === path); if (file) fixtures[path] = JSON.parse(file.content); }
  return { routes, fixtures };
}

function installMockGateway(snapshot: MockGatewaySnapshot): void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.href);
    const route = snapshot.routes.find((candidate) => (candidate.method ?? "GET") === request.method && candidate.path === url.pathname);
    if (!route) return originalFetch(input, init);
    const body = route.fixture ? snapshot.fixtures[route.fixture] : route.body ?? null;
    return new Response(JSON.stringify(body), { status: route.status ?? 200, headers: { "content-type": "application/json", ...(route.headers ?? {}) } });
  };
  (window as Window & { __MOBILE_AGENTIC_MOCKS__?: MockGatewaySnapshot }).__MOBILE_AGENTIC_MOCKS__ = snapshot;
}

function isRoute(value: unknown): value is MockRoute { return isRecord(value) && typeof value.path === "string" && value.path.startsWith("/") && (!value.method || typeof value.method === "string"); }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
