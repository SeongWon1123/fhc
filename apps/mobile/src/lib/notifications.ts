import axios from 'axios';
import { create } from 'zustand';

export interface Notification {
  readonly id: string;
  readonly user_id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>> | null;
  readonly is_read: boolean;
  readonly created_at: string;
}

const client = axios.create({
  baseURL: `${process.env.EXPO_PUBLIC_BFF_URL || 'http://localhost:3000'}/api/notifications`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  // Keep the pure unread counter usable without loading native session storage.
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

export async function listNotifications(signal?: AbortSignal): Promise<Notification[]> {
  const { data } = await client.get<Notification[]>('', { signal });
  return data;
}

export async function markRead(id: string): Promise<void> {
  await client.patch(`/${encodeURIComponent(id)}/read`);
}

export async function markAllRead(): Promise<void> {
  await client.patch('/read-all');
}

export function countUnread(notifications: readonly Pick<Notification, 'is_read'>[]): number {
  return notifications.reduce((count, item) => count + (item.is_read ? 0 : 1), 0);
}

export function bookingIdOf(notification: Pick<Notification, 'data'>): string | null {
  const id = notification.data?.booking_id;
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
}

interface NotificationState {
  readonly unreadCount: number;
  readonly refresh: (signal?: AbortSignal) => Promise<Notification[]>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  refresh: async (signal) => {
    const notifications = await listNotifications(signal);
    if (!signal?.aborted) set({ unreadCount: countUnread(notifications) });
    return notifications;
  },
}));
