import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/react";
import { Court } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export function useFavorites() {
  const { user, isSignedIn } = useUser();
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<Court[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!isSignedIn || !user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/favorites?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: Court[] = await res.json();
      setFavorites(data);
      setFavoriteIds(new Set(data.map(c => c.id)));
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = useCallback(async (courtId: number) => {
    if (!isSignedIn || !user) return;
    setFavoriteIds(prev => new Set([...prev, courtId]));
    await fetch(`${API}/favorites/${courtId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    await fetchFavorites();
  }, [isSignedIn, user, fetchFavorites]);

  const removeFavorite = useCallback(async (courtId: number) => {
    if (!isSignedIn || !user) return;
    setFavoriteIds(prev => {
      const next = new Set(prev);
      next.delete(courtId);
      return next;
    });
    setFavorites(prev => prev.filter(c => c.id !== courtId));
    await fetch(`${API}/favorites/${courtId}?userId=${encodeURIComponent(user.id)}`, {
      method: "DELETE",
    });
  }, [isSignedIn, user]);

  const toggleFavorite = useCallback(async (courtId: number) => {
    if (favoriteIds.has(courtId)) {
      await removeFavorite(courtId);
    } else {
      await addFavorite(courtId);
    }
  }, [favoriteIds, addFavorite, removeFavorite]);

  return { favorites, favoriteIds, loading, toggleFavorite, isFavorite: (id: number) => favoriteIds.has(id) };
}

export interface CoachFavoriteItem {
  id: number;
  userId: string;
  name: string;
  email: string;
  bio: string | null;
  photoUrl: string | null;
  sports: string[];
  pricePerHour: number | null;
  phone: string | null;
  status: string;
}

export function useCoachFavorites() {
  const { user, isSignedIn } = useUser();
  const [coachFavoriteIds, setCoachFavoriteIds] = useState<Set<number>>(new Set());
  const [coachFavorites, setCoachFavorites] = useState<CoachFavoriteItem[]>([]);
  const [loadingCoachFav, setLoadingCoachFav] = useState(false);

  const fetchCoachFavorites = useCallback(async () => {
    if (!isSignedIn || !user) return;
    setLoadingCoachFav(true);
    try {
      const res = await fetch(`${API}/favorites/coaches?userId=${encodeURIComponent(user.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data: CoachFavoriteItem[] = await res.json();
      setCoachFavorites(data);
      setCoachFavoriteIds(new Set(data.map(c => c.id)));
    } finally {
      setLoadingCoachFav(false);
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    fetchCoachFavorites();
  }, [fetchCoachFavorites]);

  const addCoachFavorite = useCallback(async (coachId: number) => {
    if (!isSignedIn || !user) return;
    setCoachFavoriteIds(prev => new Set([...prev, coachId]));
    await fetch(`${API}/favorites/coaches/${coachId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    await fetchCoachFavorites();
  }, [isSignedIn, user, fetchCoachFavorites]);

  const removeCoachFavorite = useCallback(async (coachId: number) => {
    if (!isSignedIn || !user) return;
    setCoachFavoriteIds(prev => {
      const next = new Set(prev);
      next.delete(coachId);
      return next;
    });
    setCoachFavorites(prev => prev.filter(c => c.id !== coachId));
    await fetch(`${API}/favorites/coaches/${coachId}?userId=${encodeURIComponent(user.id)}`, {
      method: "DELETE",
    });
  }, [isSignedIn, user]);

  const toggleCoachFavorite = useCallback(async (coachId: number) => {
    if (coachFavoriteIds.has(coachId)) {
      await removeCoachFavorite(coachId);
    } else {
      await addCoachFavorite(coachId);
    }
  }, [coachFavoriteIds, addCoachFavorite, removeCoachFavorite]);

  return {
    coachFavorites,
    coachFavoriteIds,
    loadingCoachFav,
    toggleCoachFavorite,
    isCoachFavorite: (id: number) => coachFavoriteIds.has(id),
  };
}
