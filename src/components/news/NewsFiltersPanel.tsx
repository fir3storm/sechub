"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewsFilters } from "@/components/news/NewsFilters";

interface FilterOptions {
  categories: { slug: string; name: string }[];
  devices: string[];
  osList: string[];
  sources: string[];
}

export function NewsFiltersPanel({ options }: { options: FilterOptions }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-4 lg:hidden">
        <Button
          type="button"
          variant="outline"
          className="w-full border-cyan-500/30"
          onClick={() => setOpen(true)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters & Search
        </Button>
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close filters"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto border-l border-cyan-500/20 bg-[#040810] p-4 shadow-2xl lg:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-cyan-100">
                Query Filters
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <NewsFilters options={options} />
          </div>
        </>
      )}

      <div className="hidden lg:block">
        <NewsFilters options={options} />
      </div>
    </>
  );
}
