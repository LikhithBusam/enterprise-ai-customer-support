"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const HeroScene = dynamic(
  () => import("@/components/hero-scene").then((mod) => mod.HeroScene),
  { ssr: false },
);

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(".hero-eyebrow", { opacity: 0, y: 16, duration: 0.5 })
        .from(".hero-title", { opacity: 0, y: 24, duration: 0.7 }, "-=0.3")
        .from(".hero-subtitle", { opacity: 0, y: 16, duration: 0.6 }, "-=0.4")
        .from(".hero-cta", { opacity: 0, y: 12, duration: 0.5 }, "-=0.3")
        .from(".hero-canvas", { opacity: 0, scale: 0.9, duration: 0.9 }, "-=0.6");
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-svh w-full items-center overflow-hidden bg-background"
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-6 py-24 md:grid-cols-2 md:gap-12">
        <div>
          <p className="hero-eyebrow text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Enterprise UI/UX Starter
          </p>
          <h1 className="hero-title mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            Interfaces that feel engineered, not templated.
          </h1>
          <p className="hero-subtitle mt-6 max-w-md text-lg text-muted-foreground">
            Next.js + shadcn/ui for the enterprise layer, React Three Fiber
            and GSAP for the motion layer.
          </p>
          <div className="hero-cta mt-8 flex gap-4">
            <Button size="lg">Get Started</Button>
            <Button size="lg" variant="outline">
              View Docs
            </Button>
          </div>
        </div>
        <div className="hero-canvas h-[360px] w-full md:h-[480px]">
          <HeroScene />
        </div>
      </div>
    </section>
  );
}
