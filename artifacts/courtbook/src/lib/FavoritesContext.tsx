import { createContext, useContext, ReactNode } from "react";
import { useFavorites } from "./useFavorites";
import { Court } from "@workspace/api-client-react";

interface FavoritesContextValue {
  favorites: Court[];
  favoriteIds: Set<number>;
  loading: boolean;
  toggleFavorite: (courtId: number) => Promise<void>;
  isFavorite: (id: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  favoriteIds: new Set(),
  loading: false,
  toggleFavorite: async () => {},
  isFavorite: () => false,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const value = useFavorites();
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavoritesContext() {
  return useContext(FavoritesContext);
}
