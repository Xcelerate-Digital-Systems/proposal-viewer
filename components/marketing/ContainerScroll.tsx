'use client';

import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useScroll, useTransform, motion, type MotionValue } from 'framer-motion';

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    let node = containerRef.current?.parentElement ?? null;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === 'auto' || oy === 'scroll') {
        scrollRef.current = node;
        break;
      }
      node = node.parentElement;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div
      className="h-[40rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      {ready && (
        <Inner
          containerRef={containerRef}
          scrollRef={scrollRef}
          isMobile={isMobile}
          titleComponent={titleComponent}
        >
          {children}
        </Inner>
      )}
    </div>
  );
}

function Inner({
  containerRef,
  scrollRef,
  isMobile,
  titleComponent,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLElement | null>;
  isMobile: boolean;
  titleComponent: React.ReactNode;
  children: React.ReactNode;
}) {
  const { scrollYProgress } = useScroll({
    target: containerRef,
    ...(scrollRef.current ? { container: scrollRef } : {}),
  });

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? [0.7, 0.9] : [1.05, 1],
  );
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      className="py-10 md:py-40 w-full relative"
      style={{ perspective: '1000px' }}
    >
      <motion.div
        style={{ translateY: translate }}
        className="max-w-5xl mx-auto text-center"
      >
        {titleComponent}
      </motion.div>
      <motion.div
        style={{
          rotateX: rotate,
          scale,
          boxShadow:
            '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
        }}
        className="max-w-5xl mt-8 mx-auto h-[30rem] md:h-[40rem] w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-[30px] shadow-2xl"
      >
        <div className="h-full w-full overflow-hidden rounded-2xl bg-white md:rounded-2xl md:p-4">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
