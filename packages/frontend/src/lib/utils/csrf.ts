import Cookies from 'js-cookie';

export function getCsrfToken(): string | undefined {
  return Cookies.get('csrf_token');
}
