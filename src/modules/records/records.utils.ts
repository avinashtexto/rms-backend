import { z } from 'zod';

export function isUuid(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

type LocationWithHierarchy = {
  id: string;
  name: string;
  barcode: string;
  shelf: {
    id: string;
    code: string;
    name: string;
    rack: {
      id: string;
      code: string;
      name: string;
      room: {
        id: string;
        code: string;
        name: string;
        warehouse: {
          id: string;
          code: string;
          name: string;
          site: {
            id: string;
            code: string;
            name: string;
            branch: {
              id: string;
              code: string;
              name: string;
            };
          } | null;
        };
      };
    };
  };
};

export function buildLocationBreadcrumb(location: LocationWithHierarchy | null | undefined) {
  if (!location) {
    return [];
  }

  const { shelf } = location;
  const { rack } = shelf;
  const { room } = rack;
  const { warehouse } = room;
  const site = warehouse.site;

  return [
    ...(site
      ? [
          { type: 'branch' as const, id: site.branch.id, code: site.branch.code, name: site.branch.name },
          { type: 'site' as const, id: site.id, code: site.code, name: site.name }
        ]
      : []),
    { type: 'warehouse' as const, id: warehouse.id, code: warehouse.code, name: warehouse.name },
    { type: 'room' as const, id: room.id, code: room.code, name: room.name },
    { type: 'rack' as const, id: rack.id, code: rack.code, name: rack.name },
    { type: 'shelf' as const, id: shelf.id, code: shelf.code, name: shelf.name },
    { type: 'location' as const, id: location.id, code: location.barcode, name: location.name }
  ];
}

export const locationBreadcrumbInclude = {
  shelf: {
    include: {
      rack: {
        include: {
          room: {
            include: {
              warehouse: {
                include: {
                  site: {
                    include: {
                      branch: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;
