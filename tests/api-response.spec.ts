import { describe, it, expect } from 'vitest';
import { ApiResponseHelper } from '../src/utils/api-response';

describe('ApiResponseHelper', () => {
  it('should generate standard success envelopes', () => {
    const data = { id: '1', name: 'Chat Group' };
    const res = ApiResponseHelper.success(data);

    expect(res.success).toBe(true);
    expect(res.data).toEqual(data);
    expect(res.timestamp).toBeDefined();
    expect(res.error).toBeUndefined();
  });

  it('should paginate arrays with correct metadata', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result = ApiResponseHelper.sliceArrayWithPagination(items, 2, 5);

    expect(result.items).toEqual([6, 7, 8, 9, 10]);
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(5);
    expect(result.pagination.total).toBe(12);
    expect(result.pagination.totalPages).toBe(3);
    expect(result.pagination.hasNextPage).toBe(true);
    expect(result.pagination.hasPrevPage).toBe(true);
  });

  it('should generate standard error envelopes', () => {
    const res = ApiResponseHelper.error('Invalid token', 'UNAUTHORIZED', { reason: 'expired' });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('UNAUTHORIZED');
    expect(res.error?.message).toBe('Invalid token');
    expect(res.error?.details).toEqual({ reason: 'expired' });
  });
});
