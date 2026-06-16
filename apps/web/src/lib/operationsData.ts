import type { Booking, ClothingFeedItem, Coach, Member } from '../data';
import { isSupabaseConfigured, supabase } from '../supabaseClient';

type CoachDetailsRow = {
  name?: string | null;
  specialty?: string[] | null;
  rating?: number | string | null;
  booking_count?: number | string | null;
  is_verified?: boolean | null;
  location?: string | null;
  base_price?: number | string | null;
};

type CoachProfileRow = {
  id: string;
  full_name?: string | null;
  coach_details?: CoachDetailsRow | CoachDetailsRow[] | null;
};

type MemberProfileRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  fitness_goal?: string | null;
  created_at?: string | null;
};

type RelatedProfileRow = {
  full_name?: string | null;
  email?: string | null;
};

type BookingRow = {
  id: string;
  scheduled_at: string;
  status: Booking['status'];
  amount?: number | string | null;
  price?: number | string | null;
  session_type?: Booking['session_type'] | null;
  profiles?: RelatedProfileRow | RelatedProfileRow[] | null;
  coach?: RelatedProfileRow | RelatedProfileRow[] | null;
};

type ClothingRecommendationItem = {
  name?: string | null;
  title?: string | null;
  category?: string | null;
  type?: string | null;
  price?: number | string | null;
};

type ClothingRecommendationRow = {
  id: string;
  sport_category?: string | null;
  items?: ClothingRecommendationItem[] | null;
};

type AdminOverview = {
  source: 'supabase' | 'demo-fallback';
  coaches: Coach[];
  members: Member[];
  bookings: Booking[];
  clothing_items: ClothingFeedItem[];
};

export type OperationsDataSource = AdminOverview['source'] | 'empty';

const relationOne = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const textList = (value: unknown) => (Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value ?? ''));

const isConfigured = () => isSupabaseConfigured && Boolean(supabase);
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

async function loadApiOverview(): Promise<AdminOverview | null> {
  if (!apiBaseUrl) return null;

  try {
    const response = await fetch(`${apiBaseUrl}/admin/overview`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as AdminOverview;
  } catch (error) {
    console.warn('운영 overview API를 불러오지 못했습니다.', error);
    return null;
  }
}

export async function loadCoaches(): Promise<Coach[]> {
  const overview = await loadApiOverview();
  if (overview) return overview.coaches;

  if (!isConfigured()) return [];

  const { data, error } = await supabase!
    .from('profiles')
    .select('id, full_name, role, coach_details(*)')
    .eq('role', 'coach')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('Unable to load coaches', error);
    return [];
  }

  return (data as CoachProfileRow[]).map((row) => {
    const details = relationOne(row.coach_details) ?? {};
    return {
      id: row.id,
      name: details.name || row.full_name || '이름 없는 코치',
      specialty: textList(details.specialty),
      rating: Number(details.rating ?? 0),
      booking_count: Number(details.booking_count ?? 0),
      is_verified: Boolean(details.is_verified),
      location: details.location || '온라인',
      base_price: Number(details.base_price ?? 0),
    };
  });
}

export async function loadMembers(): Promise<Member[]> {
  const overview = await loadApiOverview();
  if (overview) return overview.members;

  if (!isConfigured()) return [];

  const { data, error } = await supabase!
    .from('profiles')
    .select('id, email, full_name, fitness_goal, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('회원 데이터를 불러오지 못했습니다.', error);
    return [];
  }

  return (data as MemberProfileRow[]).map((row) => ({
    id: row.id,
    email: row.email || '',
    name: row.full_name || row.email || '이름 없는 회원',
    fitness_goal: row.fitness_goal || '미설정',
    join_date: row.created_at ? new Date(row.created_at).toLocaleDateString('ko-KR') : '',
  }));
}

export async function loadBookings(): Promise<Booking[]> {
  const overview = await loadApiOverview();
  if (overview) return overview.bookings;

  if (!isConfigured()) return [];

  const { data, error } = await supabase!
    .from('bookings')
    .select(
      'id, scheduled_at, status, amount, price, session_type, profiles!bookings_user_id_fkey(full_name, email), coach:profiles!bookings_coach_id_fkey(full_name, email)',
    )
    .order('scheduled_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    console.warn('예약 데이터를 불러오지 못했습니다.', error);
    return [];
  }

  return (data as BookingRow[]).map((row) => {
    const member = relationOne(row.profiles) ?? {};
    const coach = relationOne(row.coach) ?? {};
    return {
      id: row.id,
      user_name: member.full_name || member.email || '회원',
      coach_name: coach.full_name || coach.email || '코치',
      scheduled_at: row.scheduled_at,
      status: row.status,
      amount: Number(row.amount ?? row.price ?? 0),
      session_type: row.session_type || 'online',
    };
  });
}

export async function loadClothingFeed(): Promise<ClothingFeedItem[]> {
  const overview = await loadApiOverview();
  if (overview) return overview.clothing_items;

  if (!isConfigured()) return [];

  const { data, error } = await supabase!
    .from('clothing_recommendations')
    .select('id, sport_category, items, created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error || !data) {
    console.warn('의류 추천 데이터를 불러오지 못했습니다.', error);
    return [];
  }

  return (data as ClothingRecommendationRow[]).flatMap((row) => {
    const items = Array.isArray(row.items) ? row.items : [];
    return items.map((item, index) => ({
      id: `${row.id}-${index}`,
      sport: row.sport_category || '운동',
      category: item.category || item.type || '상품',
      item: item.name || item.title || '추천 상품',
      price: Number(item.price ?? 0),
    }));
  });
}

export async function loadOperationsData() {
  const overview = await loadApiOverview();
  if (overview) {
    return {
      source: overview.source,
      coaches: overview.coaches,
      members: overview.members,
      bookings: overview.bookings,
      clothingItems: overview.clothing_items,
    };
  }

  const [coaches, members, bookings, clothingItems] = await Promise.all([
    loadCoaches(),
    loadMembers(),
    loadBookings(),
    loadClothingFeed(),
  ]);

  return {
    source: isConfigured() ? 'supabase' : 'empty',
    coaches,
    members,
    bookings,
    clothingItems,
  } satisfies {
    source: OperationsDataSource;
    coaches: Coach[];
    members: Member[];
    bookings: Booking[];
    clothingItems: ClothingFeedItem[];
  };
}
