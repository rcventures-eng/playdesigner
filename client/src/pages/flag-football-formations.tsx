import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

const offensiveFiveOnFive = [
  {
    name: "Trips (3x1)",
    description: "Three receivers aligned to one side of the field. Creates an immediate numbers advantage against zone coverage and forces man defenders into difficult leverage decisions. The most versatile 5v5 formation.",
    bestAgainst: "Zone coverage"
  },
  {
    name: "Bunch",
    description: "Three receivers in a tight cluster at or near the line of scrimmage. Generates natural picks and rubs as routes develop, creating separation without requiring receivers to beat their defender one-on-one.",
    bestAgainst: "Man coverage"
  },
  {
    name: "Stack",
    description: "Receivers aligned directly behind one another. Forces defenders to declare their coverage early — if they stack with you, bunch routes create separation; if they don't, receivers release clean.",
    bestAgainst: "Both man and zone"
  },
  {
    name: "Spread (2x2)",
    description: "Two receivers on each side of the center. Distributes defenders across the field horizontally and creates natural isolation matchups. A reliable base formation for any offensive system.",
    bestAgainst: "Zone coverage"
  },
  {
    name: "Empty",
    description: "All four non-QB players spread wide across the field. Maximizes horizontal stress and forces the defense to cover every receiver. Leaves no checkdown receiver but creates quick-rhythm passing opportunities.",
    bestAgainst: "Soft zone coverage"
  },
];

const offensiveSevenOnSeven = [
  {
    name: "Singleback (3x1 with back)",
    description: "Three wide receivers to one side, a single back offset behind the QB. Adds a run threat and a short checkdown option while maintaining a route combination advantage to the wide side.",
    bestAgainst: "Mixed coverages"
  },
  {
    name: "Pro Set (2x2 with two backs)",
    description: "Balanced two-back alignment with two receivers on each side. Provides maximum pre-snap flexibility — you can run, pass, or motion into new formations before the snap.",
    bestAgainst: "Structured zone defenses"
  },
  {
    name: "Trips Right / Trips Left (3x1)",
    description: "Same concept as 5v5 Trips but with an additional receiver or back on the weak side. The extra player adds a backside route and holds weak-side defenders in place.",
    bestAgainst: "Zone coverage"
  },
];

const defensive = [
  {
    name: "Cover 3 Zone",
    description: "Three deep defenders split the field into thirds while underneath defenders cover short zones. The most common youth-level defense because assignments are clear and easy to teach. Vulnerable to quick horizontal routes and crossing concepts.",
  },
  {
    name: "Cover 2 Zone",
    description: "Two deep safeties each cover half the field while underneath defenders play short zones. Keeps everything in front but is vulnerable to seam routes between the two deep defenders.",
  },
  {
    name: "Man Coverage",
    description: "Each defender is assigned a specific receiver and follows them anywhere on the field. Requires athletic defenders but eliminates the route-combination advantages that beat zone. Vulnerable to picks and natural rubs from Bunch and Stack formations.",
  },
  {
    name: "4-Rush / 3-Coverage (7v7)",
    description: "Four rushers pressure the quarterback while three defenders cover the field. Balances pass rush with coverage and prevents the QB from having all day to find open receivers. The base defense for most competitive 7v7 programs.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Flag Football Formations: Offensive and Defensive Guide",
      "description": "A complete guide to flag football formations for 5v5 and 7v7, covering offensive sets like Trips, Bunch, and Stack plus defensive coverages like Cover 3 and man coverage.",
      "url": "https://rc-football.com/flag-football-formations",
      "author": { "@type": "Organization", "name": "RC Football", "url": "https://rc-football.com" },
      "publisher": { "@type": "Organization", "name": "RC Football", "url": "https://rc-football.com" },
      "datePublished": "2026-02-19",
      "dateModified": "2026-02-19"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rc-football.com" },
        { "@type": "ListItem", "position": 2, "name": "Flag Football Formations", "item": "https://rc-football.com/flag-football-formations" }
      ]
    }
  ]
};

export default function FlagFootballFormations() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>Flag Football Formations: Complete 5v5 and 7v7 Guide | RC Football</title>
        <meta name="description" content="Learn the best flag football formations for 5v5 and 7v7. Covers offensive sets like Trips, Bunch, and Stack plus defensive coverages like Cover 3 and man coverage." />
        <link rel="canonical" href="https://rc-football.com/flag-football-formations" />
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

        <h1 className="text-3xl font-bold text-white mb-4">Flag Football Formations</h1>
        <p className="text-slate-300 text-lg leading-relaxed mb-10">
          Formation choice creates pre-snap stress before any routes develop. The right formation
          puts defenders in conflict — forcing them to choose between two bad options — before the
          ball is even snapped. This guide covers the most effective offensive and defensive
          formations for 5-on-5 and 7-on-7 flag football.
        </p>

        <h2 className="text-xl font-semibold text-white mb-2">Offensive Formations — 5-on-5</h2>
        <p className="text-slate-400 text-sm mb-6">In 5v5, you have a QB and four receivers. The three formations below are the most effective at every level.</p>
        <div className="space-y-4 mb-10">
          {offensiveFiveOnFive.map((f) => (
            <div key={f.name} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-white font-semibold">{f.name}</h3>
                <span className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-0.5 shrink-0">
                  Best vs. {f.bestAgainst}
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">Offensive Formations — 7-on-7</h2>
        <p className="text-slate-400 text-sm mb-6">7v7 adds two more players, enabling run-pass option concepts and more complex route combinations.</p>
        <div className="space-y-4 mb-10">
          {offensiveSevenOnSeven.map((f) => (
            <div key={f.name} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <h3 className="text-white font-semibold mb-2">{f.name}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">Defensive Formations</h2>
        <p className="text-slate-400 text-sm mb-6">Flag football defense is coverage-first. Most formats don't allow contact at the line, which makes man coverage more difficult and route-combination attacks more powerful.</p>
        <div className="space-y-4 mb-10">
          {defensive.map((f) => (
            <div key={f.name} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <h3 className="text-white font-semibold mb-2">{f.name}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-10">
          <h2 className="text-lg font-semibold text-white mb-3">Which Formation Should You Run?</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-3">
            For 5v5, start with Trips and Bunch. Together they cover the two most common defensive
            responses — zone and man — and most of your plays can be run from both alignments.
            Add Stack once your players understand leverage and route timing.
          </p>
          <p className="text-slate-300 text-sm leading-relaxed">
            Bunch and Stack are the hardest formations to defend in flag football because defenders
            cannot re-route receivers at the line. Natural picks and crossing routes create separation
            before coverage can adjust.
          </p>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-2">Diagram These Formations in RC Football</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Build every formation above in RC Football's free play designer. Drag players into
            position, draw routes, and save your plays to a shareable playbook — no account required.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
          >
            Open the Play Designer
          </button>
        </div>
      </div>
    </div>
  );
}
