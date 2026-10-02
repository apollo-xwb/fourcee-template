"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  date?: string;
  iconClassName?: string;
  titleClassName?: string;
  iconWrapperClassName?: string;
}

export function DisplayCard({
  className,
  icon = <Sparkles className="size-4 text-blue-300" />,
  title = "Featured",
  description = "Discover amazing content",
  date = "Just now",
  iconClassName = "text-blue-500",
  titleClassName = "text-blue-500",
  iconWrapperClassName = "bg-blue-800",
}: DisplayCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-28 w-64 max-w-[85vw] sm:h-32 sm:w-72 md:h-36 md:w-[22rem] -skew-y-[8deg] select-none flex-col justify-between rounded-lg md:rounded-xl border-2 bg-muted/70 backdrop-blur-sm px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-700 after:absolute after:-right-1 after:top-[-5%] after:h-[110%] after:w-[14rem] sm:after:w-[18rem] md:after:w-[20rem] after:bg-gradient-to-l after:from-background after:to-transparent after:content-[''] hover:border-white/20 hover:bg-muted [&>*]:flex [&>*]:items-center [&>*]:gap-2",
        className
      )}
    >
      <div>
        <span className={cn("relative inline-block rounded-full p-1", iconWrapperClassName)}>
          {icon}
        </span>
        <p className={cn("text-sm sm:text-base md:text-lg font-medium", titleClassName)}>{title}</p>
      </div>
      <p className="whitespace-nowrap text-sm sm:text-base md:text-lg truncate max-w-full">{description}</p>
      <p className="text-muted-foreground text-xs sm:text-sm">{date}</p>
    </div>
  );
}

interface DisplayCardsProps {
  cards?: DisplayCardProps[];
  /** When true, each card fades/slides in with a stagger (used by splash). */
  staggerEntrance?: boolean;
}

export default function DisplayCards({ cards, staggerEntrance = false }: DisplayCardsProps) {
  const defaultCards = [
    {
      className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
    },
  ];

  const displayCards = cards || defaultCards;

  if (staggerEntrance) {
    return (
      <motion.div
        className="grid [grid-template-areas:'stack'] place-items-center opacity-100"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.2, delayChildren: 0.25 } },
        }}
      >
        {displayCards.map((cardProps, index) => (
          <motion.div
            key={index}
            className="[grid-area:stack]"
            variants={{
              hidden: { opacity: 0, y: 24, scale: 0.94 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { type: "spring", stiffness: 140, damping: 18 },
              },
            }}
          >
            <DisplayCard {...cardProps} />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div className="grid [grid-template-areas:'stack'] place-items-center opacity-100 animate-in fade-in-0 duration-700">
      {displayCards.map((cardProps, index) => (
        <DisplayCard key={index} {...cardProps} />
      ))}
    </div>
  );
}
