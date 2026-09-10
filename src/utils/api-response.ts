import { ApiResponse, PaginationMeta } from '../core/types/api.types';

export class ApiResponseHelper {
  static success<T>(data: T, pagination?: PaginationMeta): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    if (pagination) {
      response.pagination = pagination;
    }

    return response;
  }

  static error(message: string, code = 'INTERNAL_ERROR', details?: unknown): ApiResponse<never> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  static paginate<T>(
    items: T[],
    page: number,
    limit: number,
    total: number
  ): { items: T[]; pagination: PaginationMeta } {
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  static sliceArrayWithPagination<T>(
    array: T[],
    page = 1,
    limit = 10
  ): { items: T[]; pagination: PaginationMeta } {
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const total = array.length;
    const startIndex = (validPage - 1) * validLimit;
    const sliced = array.slice(startIndex, startIndex + validLimit);

    return this.paginate(sliced, validPage, validLimit, total);
  }
}
