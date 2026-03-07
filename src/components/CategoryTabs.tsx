"use client";

interface Tab {
  label: string;
  count: number;
}

export default function CategoryTabs({
  tabs,
  activeIndex,
  onChange,
}: {
  tabs: Tab[];
  activeIndex: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex items-center">
      {tabs.map((tab, i) => (
        <button
          key={tab.label}
          onClick={() => onChange(i)}
          className={`flex items-center gap-4 py-5 mr-12 text-[12px] tracking-[0.15em] uppercase transition-colors ${
            i === activeIndex
              ? "text-white font-semibold"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          <span>{tab.label}</span>
          <span className={`text-[15px] font-bold tabular-nums ${
            i === activeIndex ? "text-white" : "text-white/25"
          }`}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
