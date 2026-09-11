export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  pagination?: PaginationMeta;
  error?: ApiErrorPayload;
  timestamp: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}
