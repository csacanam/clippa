"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { ClippaLogo } from "@/components/clippa-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// -------------------------------------------------------------------------
// Pitch deck de 2 min — mismo brand sticker-pop de la app. En español.
// Navegar: → / Espacio (siguiente), ← (atrás), o click. Tecla N: notas
// del presentador (el texto hablado de cada slide).
// -------------------------------------------------------------------------

type Accent = "lime" | "magenta" | "indigo" | "peach";

const ACCENT_FILL: Record<Accent, string> = {
  lime: "bg-lime text-ink",
  magenta: "bg-magenta text-cream",
  indigo: "bg-indigo text-cream",
  peach: "bg-peach text-ink",
};

// -------------------------------------------------------------------------
// Motion
// -------------------------------------------------------------------------

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? 80 : -80, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.35,
      ease: "easeOut",
      staggerChildren: 0.07,
      delayChildren: 0.08,
    },
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? -80 : 80,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
};

const item: Variants = {
  enter: { opacity: 0, y: 16 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// -------------------------------------------------------------------------
// Building blocks
// -------------------------------------------------------------------------

function Badge({ accent, children }: { accent: Accent; children: React.ReactNode }) {
  return (
    <motion.span
      variants={item}
      className={cn(
        "inline-flex items-center rounded-full border-2 border-ink px-4 py-1.5",
        "font-display text-xs font-bold uppercase tracking-wide shadow-sticker-sm",
        ACCENT_FILL[accent]
      )}
    >
      {children}
    </motion.span>
  );
}

function Loop({ steps, accent }: { steps: string[]; accent: Accent }) {
  return (
    <motion.div variants={item} className="flex flex-wrap items-center justify-center gap-3">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-2xl border-2 border-ink px-4 py-3 font-display text-sm font-bold shadow-sticker-sm md:text-base",
              ACCENT_FILL[accent]
            )}
          >
            {s}
          </span>
          {i < steps.length - 1 && (
            <span className="font-display text-2xl font-bold text-ink-soft">→</span>
          )}
        </div>
      ))}
    </motion.div>
  );
}

function ProblemCard({
  kicker,
  accent,
  title,
  body,
}: {
  kicker: string;
  accent: Accent;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-card border-2 border-ink bg-cream px-6 py-5 text-left shadow-sticker">
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border-2 border-ink px-3 py-1",
          "font-display text-[10px] font-bold uppercase tracking-wide shadow-sticker-sm",
          ACCENT_FILL[accent]
        )}
      >
        {kicker}
      </span>
      <h3 className="font-display text-xl font-bold tracking-tight md:text-2xl">{title}</h3>
      <p className="font-body text-sm text-ink-soft md:text-base">{body}</p>
    </div>
  );
}

function NerdosCard() {
  return (
    <motion.div
      variants={item}
      className="w-full max-w-xl rounded-card border-2 border-ink bg-cream p-6 text-left shadow-sticker-lg md:p-8"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Nerdos.fun
        </h3>
        <span className="inline-flex shrink-0 items-center rounded-full border-2 border-ink bg-lime px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-ink shadow-sticker-sm">
          Campaña activa
        </span>
      </div>

      <p className="mt-3 font-body text-sm text-ink-soft md:text-base">
        Responde preguntas rápidas, compite cada día y el primer puesto gana
        desde $3 USD diarios.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-ink bg-peach px-4 py-3 shadow-sticker-sm">
        <span className="font-display text-lg font-bold">$</span>
        <span className="font-display text-sm font-bold md:text-base">
          Recompensa por cada visualización
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["TikTok", "Instagram", "YouTube Shorts", "X"].map((p) => (
          <span
            key={p}
            className="rounded-full border-2 border-ink bg-cream px-3 py-1 font-body text-xs font-medium shadow-sticker-sm"
          >
            {p}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// -------------------------------------------------------------------------
// Slides
// -------------------------------------------------------------------------

type Slide = { accent: Accent; notes: string; node: React.ReactNode };

const SLIDES: Slide[] = [
  // 1 — Logo + one-liner
  {
    accent: "lime",
    notes:
      "Hola, soy Camilo y estoy construyendo Clippa: una plataforma donde creators hacen videos cortos para productos, los publican en sus redes, suben el link y ganan dinero según las visualizaciones que generan.",
    node: (
      <>
        <motion.div variants={item} className="origin-bottom scale-150">
          <ClippaLogo />
        </motion.div>
        <motion.h1
          variants={item}
          className="mt-10 font-display text-6xl font-bold tracking-tighter md:text-8xl"
        >
          Haz clips.
          <br />
          Gana dinero.
        </motion.h1>
        <motion.p
          variants={item}
          className="mt-8 max-w-xl font-body text-lg text-ink-soft md:text-xl"
        >
          Creators hacen videos cortos para productos, suben el link y ganan
          según las visualizaciones que generan.
        </motion.p>
      </>
    ),
  },

  // 2 — Problema
  {
    accent: "magenta",
    notes:
      "Hoy construir productos es más fácil que nunca. Con IA, una o dos personas pueden lanzar apps, juegos y herramientas en pocos días. Pero distribuir sigue siendo difícil. Los equipos pequeños no tienen tiempo, presupuesto ni un equipo de marketing para crear contenido todos los días. Y al mismo tiempo, muchos jóvenes quieren ganar dinero haciendo contenido, pero no siempre saben qué promocionar, qué video hacer o cómo cobrar. Entonces hay dos problemas conectados: los productos necesitan contenido y los creators necesitan oportunidades para ganar.",
    node: (
      <>
        <Badge accent="magenta">El problema</Badge>
        <motion.h2
          variants={item}
          className="mt-6 font-display text-5xl font-bold tracking-tight md:text-7xl"
        >
          Construir es fácil.
          <br />
          Distribuir no.
        </motion.h2>
        <motion.div
          variants={item}
          className="mt-10 flex w-full max-w-3xl flex-col items-stretch gap-4 md:flex-row md:items-center"
        >
          <ProblemCard
            kicker="Productos"
            accent="magenta"
            title="Necesitan contenido"
            body="Equipos pequeños lanzan apps en días, pero no tienen tiempo ni equipo de marketing para crear contenido todos los días."
          />
          <span className="self-center font-display text-3xl font-bold text-ink-soft">
            +
          </span>
          <ProblemCard
            kicker="Creators"
            accent="indigo"
            title="Necesitan oportunidades"
            body="Quieren ganar haciendo contenido, pero no saben qué promocionar, qué video hacer ni cómo cobrar."
          />
        </motion.div>
      </>
    ),
  },

  // 3 — Solución
  {
    accent: "indigo",
    notes:
      "Clippa conecta esos dos mundos. Un producto crea una campaña con un guion, un video de ejemplo y una recompensa por visualizaciones. Los creators toman una campaña, hacen un clip, lo publican en TikTok, Instagram, YouTube Shorts o X, y suben el link. Luego ganan según el rendimiento del video. Para el creator, la promesa es muy simple: haz clips, gana dinero. Y por debajo usamos pagos con stablecoins para que puedan recibir dinero globalmente, sin depender de bancos locales o apps de pago específicas.",
    node: (
      <>
        <Badge accent="indigo">La solución</Badge>
        <motion.h2
          variants={item}
          className="mt-6 font-display text-5xl font-bold tracking-tight md:text-7xl"
        >
          Clippa conecta
          <br />
          esos dos mundos.
        </motion.h2>
        <div className="mt-10">
          <Loop
            accent="indigo"
            steps={[
              "El producto crea una campaña",
              "El creator hace un clip",
              "Lo publica + sube el link",
              "Gana según el rendimiento",
            ]}
          />
        </div>
        <motion.p
          variants={item}
          className="mt-10 max-w-xl font-body text-lg text-ink-soft md:text-xl"
        >
          Pagos con stablecoins: dinero global, sin depender de bancos locales
          ni apps de pago específicas.
        </motion.p>
      </>
    ),
  },

  // 4 — Campaña real de Nerdos.fun
  {
    accent: "peach",
    notes:
      "La primera campaña en Clippa ya es real. Es para Nerdos.fun, un juego que construí donde las personas responden preguntas rápidas, compiten todos los días y el primer puesto gana desde 3 dólares diarios. Entonces los creators pueden empezar ahora mismo haciendo clips sobre Nerdos.fun. No tienen que entender crypto. Solo tienen que crear contenido, publicarlo, subir el link y ganar según las visualizaciones que generen.",
    node: (
      <>
        <Badge accent="peach">Primera campaña — ya es real</Badge>
        <motion.h2
          variants={item}
          className="mt-6 mb-8 font-display text-4xl font-bold tracking-tight md:text-6xl"
        >
          Los creators ya pueden empezar.
        </motion.h2>
        <NerdosCard />
        <motion.p
          variants={item}
          className="mt-8 max-w-xl font-body text-base text-ink-soft md:text-lg"
        >
          Sin entender de crypto. Solo crear, publicar, subir el link y ganar.
        </motion.p>
      </>
    ),
  },

  // 5 — Invitación
  {
    accent: "lime",
    notes:
      "Clippa convierte el contenido corto en un canal de crecimiento para productos y en una oportunidad de ingresos para jóvenes creators. Si quieres empezar a ganar haciendo clips, entra a clippa.fun. Haz clips. Gana dinero.",
    node: (
      <>
        <motion.div variants={item} className="scale-125">
          <ClippaLogo />
        </motion.div>
        <motion.h2
          variants={item}
          className="mt-10 font-display text-6xl font-bold tracking-tighter md:text-8xl"
        >
          Haz clips.
          <br />
          Gana dinero.
        </motion.h2>
        <motion.p
          variants={item}
          className="mt-6 max-w-xl font-body text-lg text-ink-soft md:text-xl"
        >
          Contenido corto: un canal de crecimiento para productos y una
          oportunidad de ingresos para creators.
        </motion.p>
        <motion.a
          variants={item}
          href="https://clippa.fun"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-10 inline-flex items-center gap-2 rounded-button border-2 border-ink bg-lime px-9 py-4 font-display text-2xl font-bold tracking-tight text-ink shadow-sticker transition-[transform,box-shadow] duration-100 hover:-translate-y-[2px] hover:shadow-sticker-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-sticker-sm"
        >
          clippa.fun
        </motion.a>
      </>
    ),
  },
];

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

export default function PitchPage() {
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const [showNotes, setShowNotes] = useState(false);

  const paginate = useCallback((step: number) => {
    setState(([i]) => {
      const next = i + step;
      if (next < 0 || next >= SLIDES.length) return [i, 0];
      return [next, step];
    });
  }, []);

  const goTo = useCallback((target: number) => {
    setState(([i]) => [target, target >= i ? 1 : -1]);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        paginate(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        paginate(-1);
      } else if (e.key === "n" || e.key === "N") {
        setShowNotes((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paginate]);

  const slide = SLIDES[index];

  return (
    <main
      onClick={() => paginate(1)}
      className="relative flex h-dvh cursor-pointer select-none flex-col overflow-hidden bg-cream"
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <ClippaLogo />
        <span className="font-display text-sm font-bold tabular-nums text-ink-soft">
          {String(index + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
        </span>
      </header>

      {/* Slide */}
      <section className="flex flex-1 items-center justify-center px-6 pb-24 md:px-12">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex w-full max-w-3xl flex-col items-center text-center"
          >
            {slide.node}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Presenter notes */}
      {showNotes && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-20 cursor-default px-6 md:px-12"
        >
          <div className="mx-auto max-h-40 max-w-3xl overflow-y-auto rounded-card border-2 border-ink bg-peach px-5 py-4 shadow-sticker-lg">
            <p className="font-display text-[10px] font-bold uppercase tracking-wide text-ink-soft">
              Notas del presentador
            </p>
            <p className="mt-2 font-body text-sm text-ink md:text-base">{slide.notes}</p>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <footer
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 flex cursor-default items-center justify-between px-6 py-6 md:px-12"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => paginate(-1)}
          disabled={index === 0}
        >
          ← Atrás
        </Button>

        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              aria-label={`Ir al slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "size-3 rounded-full border-2 border-ink transition-colors",
                i === index ? ACCENT_FILL[s.accent] : "bg-cream"
              )}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => paginate(1)}
          disabled={index === SLIDES.length - 1}
        >
          Adelante →
        </Button>
      </footer>
    </main>
  );
}
