import type { Env } from './env';

export interface RouteContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
  requestId: string;
}

export type RouteHandler = (ctx: RouteContext) => Promise<Response>;

interface Route {
  method: string;
  segments: string[]; // e.g. ['api', 'v1', 'report', ':id']
  handler: RouteHandler;
}

/**
 * A route table, not a framework — matching a fixed path against ~15
 * routes doesn't need Express/Hono-style middleware chains or dependency
 * injection (see docs/SCANNER_DESIGN.md "prefer simple functions").
 * `:param` segments are the only pattern feature; that's all this API
 * needs (see docs/API.md).
 */
export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: RouteHandler): void {
    this.routes.push({ method, segments: path.split('/').filter(Boolean), handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.add('GET', path, handler);
  }
  post(path: string, handler: RouteHandler): void {
    this.add('POST', path, handler);
  }
  put(path: string, handler: RouteHandler): void {
    this.add('PUT', path, handler);
  }
  delete(path: string, handler: RouteHandler): void {
    this.add('DELETE', path, handler);
  }

  match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
    const segments = pathname.split('/').filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== segments.length) continue;
      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const routeSeg = route.segments[i];
        if (routeSeg.startsWith(':')) params[routeSeg.slice(1)] = decodeURIComponent(segments[i]);
        else if (routeSeg !== segments[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }
}
