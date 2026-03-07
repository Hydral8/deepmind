"use client";

import { Show } from "@/lib/data";
import ShowCard from "./ShowCard";

export default function ShowGrid({ shows }: { shows: Show[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {shows.map((show) => (
        <ShowCard key={show.id} show={show} />
      ))}
    </div>
  );
}
