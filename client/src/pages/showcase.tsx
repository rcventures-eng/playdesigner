import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Play, Zap, Users, BookOpen, Tag, FileText, Download, ArrowRight, Star } from "lucide-react";
import rcFootballLogo from "@assets/RC_Football_1765082048330.png";
import SignUpModal from "@/components/SignUpModal";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  isAdmin: boolean;
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

interface FeatureSection {
  id: string;
  icon: React.ReactNode;
  eyebrow: string;
  headline: string;
  description: string;
  media: { type: "video" | "image"; src: string; alt: string };
  flip: boolean;
  accent: string;
}

const features: FeatureSection[] = [
  {
    id: "draw-routes",
    icon: <Play className="w-5 h-5" />,
    eyebrow: "Play Designer",
    headline: "Draw plays in seconds.",
    description:
      "Click to place players. Click to draw routes. Every route type you need — curl, post, crossing, motion — is one tap away. Your vision on the field, instantly on screen.",
    media: { type: "video", src: "/images/drawing-routes.mp4", alt: "Drawing routes on the play designer" },
    flip: false,
    accent: "from-orange-500 to-orange-600",
  },
  {
    id: "move-players",
    icon: <Zap className="w-5 h-5" />,
    eyebrow: "Drag & Drop",
    headline: "Rearrange your whole formation in a swipe.",
    description:
      "Drag any player anywhere on the field. Set your formation from scratch or adjust an existing set — the canvas responds instantly. No menus, no friction.",
    media: { type: "video", src: "/images/moving-players.mp4", alt: "Moving players on the field" },
    flip: true,
    accent: "from-sky-500 to-sky-600",
  },
  {
    id: "build-playbook",
    icon: <BookOpen className="w-5 h-5" />,
    eyebrow: "Playbook Builder",
    headline: "Your entire game plan, organized.",
    description:
      "Group plays into playbooks, add section dividers, and structure your offense or defense the way your coaching staff thinks. Everything in one place, exportable in minutes.",
    media: { type: "video", src: "/images/playbooks.mp4", alt: "Building a playbook" },
    flip: false,
    accent: "from-emerald-500 to-emerald-600",
  },
  {
    id: "tag-plays",
    icon: <Tag className="w-5 h-5" />,
    eyebrow: "Smart Tagging",
    headline: "Find the right play at the right moment.",
    description:
      "Tag every play by situation, concept, and formation. Need a 3rd-and-short crossing concept from Trips? Filter in one click. Your playbook works as hard as you do.",
    media: { type: "video", src: "/images/tag-a-play.mp4", alt: "Tagging a play" },
    flip: true,
    accent: "from-purple-500 to-purple-600",
  },
  {
    id: "add-notes",
    icon: <FileText className="w-5 h-5" />,
    eyebrow: "Visual Notes",
    headline: "Coach your players right on the play.",
    description:
      "Drop text notes anywhere on the field. Call out assignments, add coaching cues, or mark defensive keys. Notes export with the play — nothing gets lost.",
    media: { type: "video", src: "/images/adding-notes.mp4", alt: "Adding notes to a play" },
    flip: false,
    accent: "from-yellow-500 to-yellow-600",
  },
  {
    id: "save-export",
    icon: <Download className="w-5 h-5" />,
    eyebrow: "Google Drive Export",
    headline: "Share your playbook with the whole staff.",
    description:
      "Export directly to Google Slides or Google Docs — handout or presentation format, printer-friendly mode, custom plays-per-page. Your entire playbook, ready to share, in under a minute.",
    media: { type: "image", src: "/images/export-playbook.png", alt: "Exporting a playbook" },
    flip: true,
    accent: "from-red-500 to-red-600",
  },
  {
    id: "team-management",
    icon: <Users className="w-5 h-5" />,
    eyebrow: "Team Management",
    headline: "Run your whole program from one screen.",
    description:
      "Manage rosters, organize coaching staff, build squad splits for practice, and import players from a CSV. Everything your program needs to stay organized and ready.",
    media: { type: "image", src: "/images/import-roster.png", alt: "Managing team roster" },
    flip: false,
    accent: "from-teal-500 to-teal-600",
  },
];

function FeatureBlock({ feature }: { feature: FeatureSection }) {
  const { ref, visible } = useScrollReveal();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`flex flex-col ${feature.flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-10 lg:gap-16 py-20 lg:min-h-screen lg:py-0 border-b border-slate-800 transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      {/* Media Side */}
      <div className="w-full lg:w-1/2 flex-shrink-0">
        <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10">
          {feature.media.type === "video" ? (
            <video
              ref={videoRef}
              src={feature.media.src}
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full block"
              aria-label={feature.media.alt}
            />
          ) : (
            <img
              src={feature.media.src}
              alt={feature.media.alt}
              className="w-full block"
              loading="lazy"
            />
          )}
        </div>
      </div>

      {/* Text Side */}
      <div className={`w-full lg:w-1/2 space-y-4 ${feature.flip ? "lg:text-right lg:items-end" : ""} flex flex-col`}>
        <div
          className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-gradient-to-r ${feature.accent} text-white w-fit`}
          data-testid={`badge-feature-${feature.id}`}
        >
          {feature.icon}
          {feature.eyebrow}
        </div>
        <h2
          className="text-3xl lg:text-4xl font-extrabold text-white leading-tight"
          data-testid={`heading-feature-${feature.id}`}
        >
          {feature.headline}
        </h2>
        <p className="text-slate-400 text-lg leading-relaxed" data-testid={`text-feature-${feature.id}`}>
          {feature.description}
        </p>
      </div>
    </div>
  );
}

function StatBadge({ value, label }: { value: string; label: string }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`text-center transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="text-4xl lg:text-5xl font-extrabold text-orange-400 mb-1">{value}</div>
      <div className="text-slate-400 text-sm font-medium uppercase tracking-wide">{label}</div>
    </div>
  );
}

export default function ShowcasePage() {
  const [showSignUp, setShowSignUp] = useState(false);

  const { data: user } = useQuery<UserData | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn<UserData | null>({ on401: "returnNull" }),
    retry: false,
  });

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>See RC Football in Action — Free Play Designer for Coaches</title>
        <meta
          name="description"
          content="Watch RC Football's key features in action — draw plays, build playbooks, manage rosters, and export to Google Drive. Free for all amateur coaches."
        />
        <link rel="canonical" href="https://rc-football.com/showcase" />
      </Helmet>

      {/* ── Sticky Nav ── */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800" data-testid="showcase-nav">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src={rcFootballLogo} alt="RC Football" className="h-8 w-auto object-contain" />
            <span className="font-bold text-white text-base tracking-tight hidden sm:block">RC Football</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/about"
              className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block"
              data-testid="link-about"
            >
              About
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block" data-testid="link-try">
              Try it Free
            </Link>
            {isLoggedIn ? (
              <Link
                href="/"
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-1.5 rounded-full transition-colors"
                data-testid="button-go-to-app"
              >
                Open App
              </Link>
            ) : (
              <button
                onClick={() => setShowSignUp(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-1.5 rounded-full transition-colors"
                data-testid="button-nav-signup"
              >
                Sign Up Free
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-24 lg:pt-28 lg:pb-32 text-center px-6">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-orange-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto space-y-6">
          <div
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30"
            data-testid="badge-hero-eyebrow"
          >
            <Star className="w-3.5 h-3.5" />
            Free for Every Amateur Coach
          </div>

          <h1
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight"
            data-testid="heading-hero"
          >
            Design plays.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
              Build teams.
            </span>{" "}
            Win games.
          </h1>

          <p
            className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
            data-testid="text-hero-description"
          >
            RC Football gives amateur coaches professional-grade tools — totally free.
            Draw plays, organize your playbook, manage your roster, and export everything
            to Google Drive. In your browser. In minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {isLoggedIn ? (
              <Link
                href="/"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 py-3.5 rounded-full transition-colors shadow-lg shadow-orange-500/30"
                data-testid="button-hero-open-app"
              >
                Open Play Designer
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setShowSignUp(true)}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 py-3.5 rounded-full transition-colors shadow-lg shadow-orange-500/30"
                  data-testid="button-hero-signup"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5" />
                </button>
                <Link
                  href="/"
                  className="text-slate-400 hover:text-white text-sm font-medium transition-colors underline underline-offset-4"
                  data-testid="link-hero-try"
                >
                  Try without signing up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Hero preview — main play screenshot */}
        <div className="relative max-w-4xl mx-auto mt-16">
          <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/70 ring-1 ring-white/10">
            <img
              src="/images/mesh-trips-right.png"
              alt="RC Football play designer showing a Mesh Trips Right play"
              className="w-full block"
              data-testid="img-hero-preview"
            />
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4/5 h-8 bg-black/30 blur-xl rounded-full" />
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-slate-800/50 border-y border-slate-800 py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          <StatBadge value="Free" label="Always, forever" />
          <StatBadge value="5v5→11v11" label="All formats" />
          <StatBadge value="AI" label="Play generation" />
          <StatBadge value="Drive" label="Google export" />
        </div>
      </section>

      {/* ── Feature Sections ── */}
      <section className="max-w-6xl mx-auto px-6" data-testid="section-features">
        {features.map((feature) => (
          <FeatureBlock key={feature.id} feature={feature} />
        ))}
      </section>

      {/* ── AI Callout ── */}
      <section className="py-20 px-6 bg-gradient-to-br from-slate-800 to-slate-900 border-y border-slate-700">
        <div className="max-w-4xl mx-auto flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 text-white">
              <Zap className="w-4 h-4" />
              AI Beta
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight" data-testid="heading-ai">
              Describe it. Get a play.
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed" data-testid="text-ai">
              Type "trips right with a crossing route underneath" and watch the AI draw it. Or
              sketch a diagram on your phone and have it converted automatically. Coaching ideas
              become real plays in seconds.
            </p>
          </div>
          <div className="w-full lg:w-2/5 flex-shrink-0">
            <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10">
              <img
                src="/images/four-verticals.png"
                alt="AI-generated four verticals play"
                className="w-full block"
                loading="lazy"
                data-testid="img-ai-example"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Play Examples Grid ── */}
      <section className="py-20 px-6" data-testid="section-play-examples">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white" data-testid="heading-examples">
              Every play type. Every formation.
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Offensive, defensive, and special teams plays — all on the same canvas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { src: "/images/mesh-trips-right.png", label: "Mesh — Trips Right" },
              { src: "/images/four-verticals.png", label: "Four Verticals" },
              { src: "/images/shotgun-formation.png", label: "Shotgun Formation" },
              { src: "/images/cover-3-zone.png", label: "Cover 3 Zone Defense" },
              { src: "/images/add-plays.png", label: "Play Library" },
              { src: "/images/export-playbook.png", label: "Playbook Export" },
            ].map(({ src, label }) => (
              <div key={src} className="rounded-xl overflow-hidden shadow-lg shadow-black/50 ring-1 ring-white/10 group">
                <img
                  src={src}
                  alt={label}
                  className="w-full block transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  data-testid={`img-example-${label.toLowerCase().replace(/\s+/g, "-")}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden py-24 px-6 text-center" data-testid="section-final-cta">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-orange-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto space-y-6">
          <h2
            className="text-4xl lg:text-5xl font-extrabold text-white leading-tight"
            data-testid="heading-cta"
          >
            Your playbook is waiting.
          </h2>
          <p className="text-slate-400 text-xl leading-relaxed" data-testid="text-cta">
            Sign up free in seconds. No credit card. No subscription. Just the tools you
            need to coach your best.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            {isLoggedIn ? (
              <Link
                href="/"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xl px-10 py-4 rounded-full transition-colors shadow-xl shadow-orange-500/30"
                data-testid="button-cta-open-app"
              >
                Open Play Designer
                <ArrowRight className="w-6 h-6" />
              </Link>
            ) : (
              <button
                onClick={() => setShowSignUp(true)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xl px-10 py-4 rounded-full transition-colors shadow-xl shadow-orange-500/30"
                data-testid="button-cta-signup"
              >
                Get Started Free
                <ArrowRight className="w-6 h-6" />
              </button>
            )}
          </div>
          <p className="text-slate-500 text-sm" data-testid="text-cta-no-card">
            No credit card required &middot; Free forever for amateur coaches
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 px-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
          <Link href="/" className="hover:text-orange-400 transition-colors">
            Play Designer
          </Link>
          <Link href="/about" className="hover:text-orange-400 transition-colors">
            About
          </Link>
          <Link href="/contact" className="hover:text-orange-400 transition-colors">
            Contact
          </Link>
          <Link href="/privacy-policy" className="hover:text-orange-400 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-slate-600">&copy; {new Date().getFullYear()} RC Football</span>
        </div>
      </footer>

      <SignUpModal open={showSignUp} onOpenChange={setShowSignUp} />
    </div>
  );
}
