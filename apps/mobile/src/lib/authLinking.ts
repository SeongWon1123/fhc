import * as Linking from 'expo-linking';
import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AuthLinkKind = 'signup' | 'recovery' | 'unknown';

export interface ConsumedAuthLink {
  kind: AuthLinkKind;
  session: Session | null;
}

const CALLBACK_PATH = 'auth/callback';

export const getAuthRedirectUrl = () => Linking.createURL(CALLBACK_PATH);

const getParameter = (url: string, name: string) => {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const query = queryIndex >= 0
    ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined)
    : '';
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryValue = new URLSearchParams(query).get(name);
  return queryValue ?? new URLSearchParams(fragment).get(name);
};

const getLinkKind = (type: string | null): AuthLinkKind => {
  if (type === 'recovery') return 'recovery';
  if (type === 'signup' || type === 'email') return 'signup';
  return 'unknown';
};

export const getAuthLinkErrorMessage = (url: string) => {
  const description = getParameter(url, 'error_description');
  const code = getParameter(url, 'error_code');
  if (description) return decodeURIComponent(description.replace(/\+/g, ' '));
  if (code) return '인증 링크를 처리할 수 없습니다. 새 링크를 요청한 뒤 다시 시도해주세요.';
  return null;
};

/**
 * Consumes Supabase implicit-flow links used by Expo native applications.
 * It also supports token_hash links so a custom confirmation template can be
 * adopted later without changing the app-level callback contract.
 */
export const consumeAuthLink = async (url: string): Promise<ConsumedAuthLink | null> => {
  const linkError = getAuthLinkErrorMessage(url);
  if (linkError) throw new Error(linkError);

  const accessToken = getParameter(url, 'access_token');
  const refreshToken = getParameter(url, 'refresh_token');
  const tokenHash = getParameter(url, 'token_hash');
  const type = getParameter(url, 'type');
  const kind = getLinkKind(type);

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return { kind, session: data.session };
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) throw error;
    return { kind, session: data.session };
  }

  return null;
};
