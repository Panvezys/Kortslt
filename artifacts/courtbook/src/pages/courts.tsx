import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListCourts } from "@workspace/api-client-react";
import { CourtCard } from "@/components/court-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Search } from "lucide-react";
import { ListCourtsType } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Courts() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ListCourtsType | "all">("all");
  const [priceRange, setPriceRange] = useState<[number]>([100]);

  // Pass undefined for 'all'
  const queryType = type === "all" ? undefined : type;
  
  const { data: courts, isLoading } = useListCourts({
    type: queryType,
    maxPrice: priceRange[0],
  });

  const filteredCourts = courts?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Find a Court</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Browse our selection of premium tennis and basketball courts. Filter by type, location, and price.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Filters Sidebar */}
          <aside className="w-full md:w-64 shrink-0 space-y-8 sticky top-24">
            <div>
              <Label htmlFor="search" className="mb-2 block text-sm font-medium">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="search"
                  placeholder="Court name or city..." 
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">Court Type</Label>
              <Select value={type} onValueChange={(v: ListCourtsType | "all") => setType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tennis">Tennis</SelectItem>
                  <SelectItem value="basketball">Basketball</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-4 block text-sm font-medium flex justify-between">
                <span>Max Price / Hour</span>
                <span className="text-primary font-bold">${priceRange[0]}</span>
              </Label>
              <Slider 
                value={priceRange} 
                onValueChange={(v) => setPriceRange(v as [number])} 
                max={200} 
                step={5} 
                className="my-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>$0</span>
                <span>$200+</span>
              </div>
            </div>
          </aside>

          {/* Results Grid */}
          <main className="flex-1 w-full">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {isLoading ? "Loading courts..." : `${filteredCourts?.length || 0} courts found`}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col space-y-3">
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCourts && filteredCourts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourts.map(court => (
                  <CourtCard key={court.id} court={court} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border rounded-xl bg-muted/10 border-dashed">
                <h3 className="text-xl font-bold mb-2">No courts found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search term to find what you're looking for.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
