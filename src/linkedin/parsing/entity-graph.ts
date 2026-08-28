type Entity = Readonly<Record<string, unknown>>;

function isEntity(value: unknown): value is Entity {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableIdentifiers(entity: Entity): string[] {
  return ['entityUrn', 'trackingUrn', 'urn']
    .map((key) => entity[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

export class EntityGraph {
  private readonly byUrn = new Map<string, Entity>();
  private readonly byType = new Map<string, Entity[]>();

  constructor(rawEnvelope: unknown) {
    if (!isEntity(rawEnvelope)) return;
    const included = rawEnvelope.included;
    if (!Array.isArray(included)) return;

    for (const candidate of included) {
      if (!isEntity(candidate)) continue;
      for (const identifier of stableIdentifiers(candidate)) {
        if (!this.byUrn.has(identifier)) this.byUrn.set(identifier, candidate);
      }
      const type = candidate.$type;
      if (typeof type === 'string' && type.length > 0) {
        const entities = this.byType.get(type) ?? [];
        entities.push(candidate);
        this.byType.set(type, entities);
      }
    }
  }

  getByUrn(urn: string): Entity | null {
    return this.byUrn.get(urn) ?? null;
  }

  getByType(type: string): readonly Entity[] {
    return this.byType.get(type) ?? [];
  }
}
