import { LucideIcon } from "lucide-react"

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  color: "teal" | "purple" | "amber" | "blue"
  delay: number
}

const colorMap = {
  teal: { 
    bg: "bg-[#06d6a0]/10", 
    text: "text-[#06d6a0]", 
    glow: "#06d6a0",
    border: "group-hover:border-[#06d6a0]/40"
  },
  purple: { 
    bg: "bg-[#7c3aed]/10", 
    text: "text-[#7c3aed]", 
    glow: "#7c3aed",
    border: "group-hover:border-[#7c3aed]/40"
  },
  amber: { 
    bg: "bg-[#f59e0b]/10", 
    text: "text-[#f59e0b]", 
    glow: "#f59e0b",
    border: "group-hover:border-[#f59e0b]/40"
  },
  blue: { 
    bg: "bg-[#3b82f6]/10", 
    text: "text-[#3b82f6]", 
    glow: "#3b82f6",
    border: "group-hover:border-[#3b82f6]/40"
  },
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: StatCardProps) {
  const c = colorMap[color]

  return (
    <div
      className={`relative group bg-[#131829] border border-[#1e2440] rounded-xl p-5 ${c.border} transition-all duration-500 hover:-translate-y-1 overflow-hidden`}
      style={{ 
        animationDelay: `${delay}ms`,
        animation: `fadeInUp 0.6s ease-out ${delay}ms both`
      }}
    >
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 100%, ${c.glow}10, transparent 60%)`
        }}
      />

      <div className="relative">
        <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
          <Icon size={24} className={c.text} />
        </div>

        <p className="text-sm text-[#7b829c] mb-2 tracking-wide">{label}</p>
        
        <div className="relative">
          <p className="text-4xl font-bold text-[#e4e8f1]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <div 
            className="absolute -inset-4 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl"
            style={{ backgroundColor: c.glow }}
          />
        </div>

        <div className="mt-4 h-10">
          <svg width="100%" height="40" viewBox="0 0 140 40" preserveAspectRatio="none" className="overflow-visible">
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.glow} stopOpacity="0.3" />
                <stop offset="100%" stopColor={c.glow} stopOpacity="0" />
              </linearGradient>
              <filter id={`glow-${label}`}>
                <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <path
              d={generateSmoothPath(c.glow)}
              fill={`url(#grad-${label})`}
              stroke={c.glow}
              strokeWidth="2"
              fillOpacity="1"
              filter={`url(#glow-${label})`}
              className="transition-all duration-700"
            />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

function generateSmoothPath(color: string): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const base = Math.sin(i * 0.8) * 8 + 15
    return base + (Math.random() - 0.5) * 6
  })
  
  const step = 140 / 9
  let path = `M0,${40 - points[0]}`
  
  for (let i = 1; i < points.length; i++) {
    const x = i * step
    const y = 40 - points[i]
    const prevX = (i - 1) * step
    const prevY = 40 - points[i - 1]
    const cpX1 = prevX + step * 0.35
    const cpX2 = x - step * 0.35
    path += ` C${cpX1},${prevY} ${cpX2},${y} ${x},${y}`
  }
  
  path += ` L${140},40 L0,40 Z`
  return path
}
