// Base response structure for offset-based pagination
export interface OffsetPaginatedResponse<T> {
  data: T[];
  pagination: {
    type: 'offset';
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Base response structure for cursor-based pagination
export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    type: 'cursor';
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
}

// Keep the union type for cases where we need flexibility
export interface PaginatedResponse<T> {
  data: T[];
  pagination: OffsetPagination | CursorPagination;
}

export interface OffsetPagination {
  type: 'offset';
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CursorPagination {
  type: 'cursor';
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}
