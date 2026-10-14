import React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { CountUp } from './count-up';

export { CountUp };

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Section reveal. Reduced motion is a short fade with no transform.
 * The wrapper is an extra element around existing children; it does not rewrite their text.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: reduce ? 0.2 : 0.65, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

/** Word-by-word headline. The joined text is the original sentence. */
export function StaggerWords({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <motion.span
      className={className}
      style={{ display: 'block' }}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduce ? 0 : 0.06, delayChildren: reduce ? 0 : 0.05 } },
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block"
          variants={{
            hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.2 : 0.5, ease } },
          }}
        >
          {word}
          {i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </motion.span>
  );
}

type PressProps = HTMLMotionProps<'button'> & { children?: React.ReactNode };

/** Hover and press on a real button. Reduced motion keeps it still. */
export function PressButton({ children, ...props }: PressProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      {...props}
      whileHover={reduce ? undefined : { scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.18, ease }}
    >
      {children}
    </motion.button>
  );
}
