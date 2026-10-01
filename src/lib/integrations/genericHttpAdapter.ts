import { tokenVault } from "./tokenVault";

export interface HttpRequest { providerId: string; url: string; method?: string; headers?: Record<string, string>; body?: unknown; tokenKey?: string; tokenHeader?: string; }
export interface HttpResponse { status: number; headers: Record<string, string>; body: unknown; }

export class GenericHttpAdapter {
  async request(input: HttpRequest): Promise<HttpResponse> { const token = await tokenVault.read(input.providerId, input.tokenKey ?? "accessToken"); const headers = { Accept: "application/json", ...(input.headers ?? {}), ...(token ? { [input.tokenHeader ?? "Authorization"]: input.tokenHeader ? token : `Bearer ${token}` } : {}) }; const response = await fetch(input.url, { method: input.method ?? "GET", headers: input.body === undefined ? headers : { ...headers, "Content-Type": "application/json" }, body: input.body === undefined ? undefined : JSON.stringify(input.body) }); return this.parse(response); }
  async webhook(providerId: string, url: string, payload: unknown, headers: Record<string, string> = {}): Promise<HttpResponse> { return this.request({ providerId, url, method: "POST", headers, body: payload }); }
  private async parse(response: Response): Promise<HttpResponse> { const contentType = response.headers.get("content-type") ?? ""; const body = contentType.includes("json") ? await response.json() : await response.text(); if (!response.ok) throw new Error(`Integration HTTP ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`); return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body }; }
}

export const genericHttpAdapter = new GenericHttpAdapter();
