"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Só monta (hooks, refs, listeners de hover, registo de transição) o que
// entra perto do ecrã — enquanto invisível, o filho fica por processar,
// só a caixa reserva o espaço (evita saltos de layout ao aparecer). className
// reserva a LARGURA (necessário em rows flex com shrink-0, onde a largura vem
// do conteúdo — sem filho montado, colapsava); minHeight reserva a altura.
export function LazyMount({
  children,
  className,
  minHeight,
}: {
  children: ReactNode;
  className?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible ? children : null}
    </div>
  );
}
