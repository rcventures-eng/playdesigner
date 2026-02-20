import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

const sections = [
  {
    title: "Base Offense",
    description: "Your 5–7 most-used plays that form the foundation of your offensive game plan. These should be executable against any coverage and runnable from your primary formations. Your team should know these plays well enough to run them under pressure without a huddle."
  },
  {
    title: "3rd and Short",
    description: "2–3 high-percentage completion plays designed to move the chains. Typically short routes (slants, drags, quick outs) with fast QB release times. These should be your most reliable plays, not your flashiest."
  },
  {
    title: "Red Zone",
    description: "1–2 plays designed for tight-coverage situations near the end zone. In a compressed field, route separation is harder to create — bunch concepts and back-shoulder throws work better than vertical routes."
  },
  {
    title: "Two-Minute Drill",
    description: "Quick-tempo plays your offense can execute without a huddle when time is short. Every player should know their assignment from a single word or number call. Simplicity matters more than complexity here."
  },
  {
    title: "Specials / Trick Plays",
    description: "1–2 gadget plays for specific situations — a reverse, a double pass, a direct snap to a receiver. Use sparingly and only when your team has practiced them enough to execute confidently. A trick play that fails at a critical moment is worse than not having one."
  },
];

const foundationalPlays = [
  { name: "Run or run-action play", reason: "Establishes a run threat that holds defenders in place, even in a passing-heavy format." },
  { name: "Crossing route concept (mesh)", reason: "Creates natural picks and high-percentage completions against both man and zone coverage." },
  { name: "Vertical threat with checkdown", reason: "Tests deep coverage and gives the QB a safe outlet when the deep route isn't open." },
  { name: "Screen or quick game", reason: "Gets the ball out fast against blitz pressure and gains yards after the catch." },
  { name: "Red zone-specific play", reason: "Designed for a compressed field where your base routes won't create the same separation." },
  { name: "One trick play", reason: "Keeps the defense honest and can swing momentum if used at the right moment." },
];

const mistakes = [
  "Building a 40-play playbook before your team has mastered 10",
  "Organizing plays by number instead of situation",
  "Teaching receiver routes without teaching quarterback reads",
  "Never updating the playbook after seeing how defenses adjust",
  "Keeping the playbook in your head instead of a shareable format your players can study",
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Beginner's Guide to Flag Football Playbooks",
      "description": "How to build a flag football playbook from scratch — what to include, how to organize it, the six plays every beginner needs, and common mistakes to avoid.",
      "url": "https://rc-football.com/flag-football-playbook-guide",
      "author": { "@type": "Organization", "name": "RC Football", "url": "https://rc-football.com" },
      "publisher": { "@type": "Organization", "name": "RC Football", "url": "https://rc-football.com" },
      "datePublished": "2026-02-19",
      "dateModified": "2026-02-19"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rc-football.com" },
        { "@type": "ListItem", "position": 2, "name": "Flag Football Playbook Guide", "item": "https://rc-football.com/flag-football-playbook-guide" }
      ]
    }
  ]
};

export default function FlagFootballPlaybookGuide() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>Beginner's Guide to Flag Football Playbooks | RC Football</title>
        <meta name="description" content="How to build a flag football playbook from scratch — what sections to include, the 6 foundational plays every team needs, how to organize by situation, and common mistakes to avoid." />
        <link rel="canonical" href="https://rc-football.com/flag-football-playbook-guide" />
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => setLocation("/")}
          className="text-sm text-orange-400 hover:text-orange-300 transition-colors mb-8 inline-block"
        >
          &larr; Back to RC Football
        </button>

        <h1 className="text-3xl font-bold text-white mb-4">Beginner's Guide to Flag Football Playbooks</h1>
        <p className="text-slate-300 text-lg leading-relaxed mb-4">
          A flag football playbook is more than a list of plays. It's an organized system your team
          can execute under pressure, adjust at halftime, and build on across a season. This guide
          covers how to build one from scratch — what to include, how to organize it, and the
          mistakes most first-year coaches make.
        </p>
        <p className="text-slate-400 mb-10">
          Start with 10–15 plays and master those before adding more. Execution depth beats
          playbook volume at every level of flag football.
        </p>

        <h2 className="text-xl font-semibold text-white mb-4">What Should Be in a Flag Football Playbook?</h2>
        <p className="text-slate-400 mb-6">
          Organize your playbook by game situation, not by play number. Coaches who number their plays
          sequentially end up flipping through the entire book during a two-minute drill. Coaches who
          organize by situation find the right play in seconds.
        </p>
        <div className="space-y-4 mb-12">
          {sections.map((s) => (
            <div key={s.title} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <h3 className="text-white font-semibold mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">The 6 Plays Every Beginner Playbook Needs</h2>
        <p className="text-slate-400 mb-6">
          Before you design anything creative, make sure you have these six foundational plays. They
          cover the most common game situations and give your offense a complete toolkit without
          overwhelming your players.
        </p>
        <div className="space-y-3 mb-12">
          {foundationalPlays.map((p, i) => (
            <div key={p.name} className="flex gap-4 bg-slate-800 border border-slate-700 rounded-lg p-4">
              <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <span className="text-white text-sm font-semibold">{p.name} </span>
                <span className="text-slate-400 text-sm">— {p.reason}</span>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">How to Teach Your Plays</h2>
        <ul className="space-y-3 mb-12">
          {[
            "Walk through each play without a ball first — movement without execution pressure helps players learn assignments faster.",
            "Teach the quarterback's reads alongside receiver routes. Players execute better when they understand the whole play, not just their individual route.",
            "Provide printed or digital diagrams your players can study before practice. Coaches who hand out diagrams see faster retention.",
            "Repeat each play until execution is automatic before adding new ones. Mastery of fewer plays beats familiarity with many.",
            "Connect every play to a specific game situation when you teach it — 'this is what we run on third and short' builds game awareness alongside technique.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="text-orange-400 mt-0.5 shrink-0">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>

        <h2 className="text-xl font-semibold text-white mb-4">Common Mistakes to Avoid</h2>
        <div className="space-y-2 mb-12">
          {mistakes.map((m) => (
            <div key={m} className="flex items-start gap-3 bg-slate-800 border border-red-900/30 rounded-lg px-4 py-3">
              <span className="text-red-400 mt-0.5 shrink-0 text-xs">✕</span>
              <span className="text-slate-300 text-sm">{m}</span>
            </div>
          ))}
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-2">Build Your Playbook in RC Football</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            RC Football gives you everything you need to build, organize, and share a professional-quality
            playbook — play designer, team management, playbook sections, and Google Drive export.
            All free, forever, for amateur coaches.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
          >
            Start Building Your Playbook
          </button>
        </div>
      </div>
    </div>
  );
}
