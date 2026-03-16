import type { Fetcher } from '../../helpers/apiFetch';

export default async function data(_env: { API_WORKER?: Fetcher }, _request: Request) {
  // createApiFetch를 사용하여 API worker 호출 예시
  // const { createApiFetch } = await import('../../helpers/apiFetch');
  // const apiFetch = createApiFetch(env, request);
  // const response = await apiFetch('/api/users');
  // const users = await response.json();

  return {
    message: 'Hello from {{projectName}}!',
  };
}
