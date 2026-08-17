import { Request, Response, NextFunction } from 'express';

/** Skip this router when the path does not match — avoids global auth on unrelated admin paths. */
export function skipRouterUnlessPathMatches(prefixes: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const matches = prefixes.some(
      (prefix) => req.path === prefix || req.path.startsWith(prefix)
    );
    if (!matches) {
      return next('router');
    }
    return next();
  };
}
