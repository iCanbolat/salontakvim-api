import { SQL, and, or } from 'drizzle-orm';

type MaybeCondition = SQL | undefined | null;

export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface PaginationState {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<TEntity> {
  data: TEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export abstract class BaseRepository<TEntity> {
  protected constructor(protected readonly db: any) {}

  protected normalizePagination(
    options: PaginationOptions = {},
    defaultLimit = 10,
    defaultMaxLimit = 100,
  ): PaginationState {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limitRaw =
      options.limit && options.limit > 0 ? options.limit : defaultLimit;
    const maxLimit = options.maxLimit ?? defaultMaxLimit;
    const limit = Math.min(limitRaw, maxLimit);

    return {
      page,
      limit,
      offset: (page - 1) * limit,
    };
  }

  protected async executePaginatedQuery<TResult>(
    pagination: PaginationState,
    queryFactory: (limit: number, offset: number) => Promise<TResult[]>,
    countFactory: () => Promise<number>,
  ): Promise<PaginatedResult<TResult>> {
    const data = await queryFactory(pagination.limit, pagination.offset);
    const total = await countFactory();
    const totalPages = Math.max(1, Math.ceil(total / pagination.limit) || 1);

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
    };
  }

  protected combineWithAnd(conditions: MaybeCondition[]): SQL | undefined {
    const filtered = conditions.filter((condition): condition is SQL =>
      Boolean(condition),
    );

    if (filtered.length === 0) {
      return undefined;
    }

    if (filtered.length === 1) {
      return filtered[0];
    }

    return and(...filtered);
  }

  protected combineWithOr(conditions: MaybeCondition[]): SQL | undefined {
    const filtered = conditions.filter((condition): condition is SQL =>
      Boolean(condition),
    );

    if (filtered.length === 0) {
      return undefined;
    }

    if (filtered.length === 1) {
      return filtered[0];
    }

    return or(...filtered);
  }

  protected formatSearchPattern(search?: string): string | null {
    const trimmed = search?.trim();
    if (!trimmed) {
      return null;
    }

    return `%${trimmed}%`;
  }

  protected parseDate(
    value?: string,
    options: { endOfDay?: boolean } = {},
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    if (options.endOfDay && value.length <= 10) {
      parsed.setHours(23, 59, 59, 999);
    }

    return parsed;
  }
}
