import { Router, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../auth/auth.types';
import { prisma } from '../../lib/prisma';

/**
 * Mobile search endpoints.
 *
 * The mobile app (`SearchApiService`) calls:
 *   GET /search?query=<q>&type=<BOX|FILE|ALL>   -> List<SearchResultDto>
 *   GET /search/barcode?barcode=<code>          -> SearchResultDto?  (nullable)
 *
 * These are mounted BEFORE the shared `boxRoutes` on the mobile router so the
 * app's `query`/`type` params and the `SearchResultDto` response shape are
 * served here rather than by the admin-shared `/search` handler (which reads
 * `?q=` and returns a different shape).
 */
const router = Router();

router.use(requireAuth as any);

// Shape a Box row into the SearchResultDto the app expects.
function boxToResult(box: any) {
  return {
    type: 'BOX',
    id: box.id,
    barcode: box.barcode,
    name: box.description ?? null,
    title: null as string | null,
    location: box.currentLocation?.name ?? 'Unassigned',
    clientId: box.clientId ?? null,
    clientName: box.client?.name ?? null,
    boxBarcode: box.barcode
  };
}

// Shape a FileRecord row (with its box) into the SearchResultDto the app expects.
function fileToResult(file: any) {
  return {
    type: 'FILE',
    id: file.id,
    barcode: file.barcode,
    name: null as string | null,
    title: file.title ?? null,
    location: file.box?.currentLocation?.name ?? 'Unassigned',
    clientId: file.box?.clientId ?? null,
    clientName: file.box?.client?.name ?? null,
    boxBarcode: file.box?.barcode ?? null
  };
}

const boxInclude = { client: true, currentLocation: true };
const fileInclude = { box: { include: { client: true, currentLocation: true } } };

// GET /search?query=&type=
router.get('/search', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const query = ((req.query.query as string) || (req.query.q as string) || '').trim();
    const type = ((req.query.type as string) || 'ALL').toUpperCase();

    const results: any[] = [];

    if (type === 'BOX' || type === 'ALL') {
      const boxes = await prisma.box.findMany({
        where: {
          companyId,
          ...(query
            ? { OR: [{ barcode: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] }
            : {})
        },
        include: boxInclude,
        take: 25,
        orderBy: { createdAt: 'desc' }
      });
      results.push(...boxes.map(boxToResult));
    }

    if (type === 'FILE' || type === 'ALL') {
      const files = await prisma.fileRecord.findMany({
        where: {
          companyId,
          ...(query
            ? { OR: [{ barcode: { contains: query, mode: 'insensitive' } }, { title: { contains: query, mode: 'insensitive' } }] }
            : {})
        },
        include: fileInclude,
        take: 25,
        orderBy: { createdAt: 'desc' }
      });
      results.push(...files.map(fileToResult));
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// GET /search/barcode?barcode=  -> single result or null
router.get('/search/barcode', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const companyId = req.user!.companyId;
    const barcode = ((req.query.barcode as string) || '').trim();

    if (!barcode) {
      return res.status(200).json({ success: true, data: null });
    }

    const box = await prisma.box.findFirst({
      where: { companyId, barcode },
      include: boxInclude
    });
    if (box) {
      return res.status(200).json({ success: true, data: boxToResult(box) });
    }

    const file = await prisma.fileRecord.findFirst({
      where: { companyId, barcode },
      include: fileInclude
    });
    if (file) {
      return res.status(200).json({ success: true, data: fileToResult(file) });
    }

    return res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
});

export default router;
