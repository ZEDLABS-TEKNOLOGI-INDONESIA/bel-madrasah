import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glossy?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  glossy = true,
  hover = false,
  onClick,
  style,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: glossy ? "var(--card-gloss), var(--card-bg)" : "var(--bg-secondary)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--card-shadow)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      onMouseEnter={
        hover
          ? (e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "var(--card-shadow)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
