import { apiClient, api } from './api/client';

export { apiClient, api };
export async function apiRequest(endpoint, options = {}) {
  return apiClient(endpoint, options);
}
export default apiClient;
