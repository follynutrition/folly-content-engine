export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[4px] text-[10px] font-mono bg-white/6 text-white/22 border border-white/4 leading-none">
      {children}
    </span>
  );
}
