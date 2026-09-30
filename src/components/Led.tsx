import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Amber scoreboard number that flashes green or red and rolls when it changes. */
export function Led({ value, text, className = "", flash = true }: { value: number; text: string; className?: string; flash?: boolean }) {
  const prev = useRef(value);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  useEffect(() => {
    if (value !== prev.current) {
      setDir(value > prev.current ? 1 : -1);
      prev.current = value;
      const t = setTimeout(() => setDir(0), 900);
      return () => clearTimeout(t);
    }
  }, [value]);
  const color = !flash || dir === 0 ? undefined : dir > 0 ? "var(--color-up)" : "var(--color-dn)";
  return (
    <span className={`relative inline-flex overflow-hidden align-baseline ${className}`} style={{ color, transition: "color .6s" }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={{ y: dir >= 0 ? "90%" : "-90%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: dir >= 0 ? "-90%" : "90%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="inline-block"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
