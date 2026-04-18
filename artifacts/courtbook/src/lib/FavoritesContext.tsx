import { createContext, useContext, ReactNode } from "react";
import { useFavorites, useCoachFavorites, type CoachFavoriteItem } from "./useFavorites";
import { Court } from "@workspace/api-client-react";

interface FavoritesContextValue {
  favorites: Court[];
  favoriteIds: Set<number>;
  loading: boolean;
  toggleFavorite: (courtId: number) => Promise<void>;
  isFavorite: (id: number) => boolean;
  coachFavorites: CoachFavoriteItem[];
  coachFavoriteIds: Set<number>;
  loadingCoachFav: boolean;
  toggleCoachFavorite: (coachId: number) => Promise<void>;
  isCoachFavorite: (id: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  favoriteIds: new Set(),
  loading: false,
  toggleFavorite: async () => {},
  isFavorite: () => false,
  coachFavorites: [],
  coachFavoriteIds: new Set(),
  loadingCoachFav: false,
  toggleCoachFavorite: async () => {},
  isCoachFavorite: () => false,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const courtFavs = useFavorites();
  const coachFavs = useCoachFavorites();
  return (
    <FavoritesContext.Provider value={{ ...courtFavs, ...coachFavs }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext() {
  return useContext(FavoritesContext);
}
