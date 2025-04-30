export interface OAuthUser {
  id: string;
  email: string;
  name?: string;
  accessToken: string;
  sessionId: string;
}
