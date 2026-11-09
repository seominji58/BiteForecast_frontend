import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { api, ApiError } from '@/api';
import type { Account, AuthResult } from '@/api/types';
import { googleSignOut } from '@/lib/google';
import { loadToken, onTokenChange, setToken } from '@/lib/session';

type Status = 'loading' | 'guest' | 'signed-in';

type AuthContext = {
  status: Status;
  signedIn: boolean;
  account: Account | null;
  /** 가입·로그인 성공 응답을 반영 (토큰 저장 + 기기 기록 이전 안내) */
  signIn: (res: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  setAccount: (a: Account) => void;
};

const Ctx = createContext<AuthContext | null>(null);

/**
 * 로그인 상태 (2026-11-09 결정: 읽기는 누구나, 쓰기·기록·포인트는 로그인).
 * 앱을 켤 때 저장된 토큰으로 계정을 확인하고, 만료(401)면 손님 상태로 돌아간다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let alive = true;
    loadToken().then(async (t) => {
      if (!t) return alive && setStatus('guest');
      try {
        const a = await api.account();
        if (!alive) return;
        setAccount(a);
        setStatus('signed-in');
      } catch (e) {
        if (!alive) return;
        // 네트워크 오류면 로그인 상태는 유지 (다음 요청에서 다시 확인), 401 이면 토큰이 이미 지워졌다
        setStatus(e instanceof ApiError && e.status === 401 ? 'guest' : 'signed-in');
      }
    });
    // 어떤 요청에서든 401 로 토큰이 지워지면 손님 상태로
    const off = onTokenChange((t) => {
      if (!t) {
        setAccount(null);
        setStatus('guest');
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const refreshUserData = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['journals'] }),
      qc.invalidateQueries({ queryKey: ['me'] }),
      qc.invalidateQueries({ queryKey: ['community'] }),
    ]);

  const signIn = async (res: AuthResult) => {
    await setToken(res.token);
    setAccount(res.account);
    setStatus('signed-in');
    await refreshUserData();
    const m = res.merge;
    const what = [m.journals ? `기록 ${m.journals}건` : null, m.posts ? `글 ${m.posts}건` : null].filter(Boolean).join(', ');
    if (m.done && what) {
      Alert.alert('이전 기록을 이어받았어요', `이 기기에서 로그인 없이 쓴 ${what}을 ${res.account.nickname} 계정으로 옮겼어요.`);
    } else if (m.available && what) {
      Alert.alert('이 기기의 기록을 옮길까요?', `로그인 없이 쓴 ${what}이 있어요. ${res.account.nickname} 계정으로 옮길까요?`, [
        { text: '나중에', style: 'cancel' },
        {
          text: '옮기기',
          onPress: () =>
            api
              .mergeDevice()
              .then(refreshUserData)
              .catch((e: Error) => Alert.alert('옮기지 못했어요', e.message)),
        },
      ]);
    }
  };

  const signOut = async () => {
    await api.logout().catch(() => undefined);
    await googleSignOut();
    await setToken(null);
    await refreshUserData();
  };

  return (
    <Ctx.Provider value={{ status, signedIn: status === 'signed-in', account, signIn, signOut, setAccount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContext {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider 안에서만 쓸 수 있어요');
  return v;
}
