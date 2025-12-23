/**
 * Kanban Configuration API
 * Handles API calls for Kanban board configuration
 */

import apiClient from "./axios";

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  icon: string;
  gmailLabel?: string;
  order: number;
}

export interface KanbanConfig {
  _id: string;
  userId: string;
  columns: KanbanColumn[];
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Get user's Kanban configuration
 */
export const getKanbanConfig = async (): Promise<KanbanConfig> => {
  const response = await apiClient.get<ApiResponse<KanbanConfig>>(
    "/kanban/config"
  );
  return response.data.data!;
};

/**
 * Update user's Kanban configuration
 */
export const updateKanbanConfig = async (
  columns: KanbanColumn[]
): Promise<KanbanConfig> => {
  const response = await apiClient.put<ApiResponse<KanbanConfig>>(
    "/kanban/config",
    { columns }
  );
  return response.data.data!;
};

/**
 * Add a new column
 */
export const addKanbanColumn = async (
  column: KanbanColumn
): Promise<KanbanConfig> => {
  const response = await apiClient.post<ApiResponse<KanbanConfig>>(
    "/kanban/config/columns",
    column
  );
  return response.data.data!;
};

/**
 * Delete a column
 */
export const deleteKanbanColumn = async (
  columnId: string
): Promise<KanbanConfig> => {
  const response = await apiClient.delete<ApiResponse<KanbanConfig>>(
    `/kanban/config/columns/${columnId}`
  );
  return response.data.data!;
};

/**
 * Update a specific column
 */
export const updateKanbanColumn = async (
  columnId: string,
  updates: Partial<KanbanColumn>
): Promise<KanbanConfig> => {
  const response = await apiClient.patch<ApiResponse<KanbanConfig>>(
    `/kanban/config/columns/${columnId}`,
    updates
  );
  return response.data.data!;
};
