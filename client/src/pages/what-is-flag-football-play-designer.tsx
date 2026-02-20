import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "What Is a Flag Football Play Designer?",
      "description": "A flag football play designer is a digital tool that lets coaches visually diagram offensive formations, receiver routes, and assignments on a virtual field.",
      "url": "https://rc-football.com/what-is-a-flag-football-play-designer",
      "author": {
        "@type": "Organization",
        "name": "RC Football",
        "url": "https://rc-football.com"
      },
      "publisher": {
        "@type": "Organization",
        "name": "RC Football",
        "url": "https://rc-football.com"
      },
      "datePublished": "2026-02-19",
      "dateModified": "2026-02-19"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rc-football.com" },
        { "@type": "ListItem", "position": 2, "name": "What Is a Flag Football Play Designer?", "item": "https://rc-football.com/what-is-a-flag-football-play-designer" }
      ]
    }
  ]
};

const differences = [
  {
    heading: "No contact blocking",
    body: "Flag football removes linemen from most formations. Play designers built for tackle football waste screen space on blocking assignments that don't apply."
  },
  {
    heading: "Smaller formats",
    body: "5-on-5 and 7-on-7 layouts require different field spacing and route combinations than 11-on-11. A purpose-built tool reflects that."
  },
  {
    heading: "Route emphasis",
    body: "Because every player is a receiver in flag football, route trees and motion patterns matter more than run blocking or line technique."
  }
];

const useCases = [
  { title: "Youth coaches", description: "First-year volunteers who need to present plays clearly to young players benefit from simple drag-and-drop tools they can learn in minutes." },
  { title: "7-on-7 tournament organizers", description: "Tournament play requires a larger playbook and faster adjustments. Digital organization beats printed clipboards." },
  { title: "Recreational league coaches", description: "Adult flag football leagues are growing fast. Coaches who treat their team seriously want pro-quality tools at a free price." },
  { title: "High school coordinators", description: "Coaches moving from tackle to flag formats appreciate a dedicated tool that doesn't require unlearning tackle football conventions." },
];

export default function WhatIsFlagFootballPlayDesigner() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>What Is a Flag Football Play Designer? | RC Football</title>
        <meta name="description" content="A flag football play designer is a digital tool that lets coaches diagram formations, draw routes, and build playbooks. Learn what it does and why coaches use one." />
        <link rel="canonical" href="https://rc-football.com/what-is-a-flag-football-play-designer" />
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

        <h1 className="text-3xl font-bold text-white mb-4">What Is a Flag Football Play Designer?</h1>
        <p className="text-slate-300 text-lg leading-relaxed mb-10">
          A flag football play designer is a digital tool that lets coaches visually diagram offensive
          formations, receiver routes, blocking assignments, and quarterback reads on a virtual field.
          Think of it as a digital whiteboard built specifically for football — one where you place
          players, draw where they move, and save everything in an organized playbook your team can
          actually use.
        </p>

        <h2 className="text-xl font-semibold text-white mb-4">What a Play Designer Does</h2>
        <ul className="space-y-3 mb-10">
          {[
            "Place players in any formation on a scaled flag football field",
            "Draw routes, motion paths, and blocking assignments for each player",
            "Add notes and coaching cues directly to the diagram",
            "Save plays to named playbooks organized by team or game situation",
            "Export diagrams as images or send directly to Google Drive",
            "Share playbooks with assistant coaches or players",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-slate-300">
              <span className="text-orange-400 mt-1 shrink-0">→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <h2 className="text-xl font-semibold text-white mb-4">How It Differs from Tackle Football Tools</h2>
        <p className="text-slate-400 mb-6">
          Generic football diagramming tools are built around 11-on-11 tackle football. Flag football
          has different rules, different formats, and different strategic priorities. A purpose-built
          flag football play designer accounts for three key differences:
        </p>
        <div className="space-y-4 mb-10">
          {differences.map((d) => (
            <div key={d.heading} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <h3 className="text-white font-semibold mb-1">{d.heading}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{d.body}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">Who Uses a Flag Football Play Designer?</h2>
        <div className="grid gap-4 sm:grid-cols-2 mb-10">
          {useCases.map((u) => (
            <div key={u.title} className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <h3 className="text-white font-semibold mb-2">{u.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{u.description}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">Why Use One Instead of a Whiteboard?</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          Whiteboards work in the moment. A play designer works before, during, and after the game.
          Your plays are saved, searchable, and shareable. You can build a full playbook over a season,
          export it for your players to study at home, and update it between games without starting over.
        </p>
        <p className="text-slate-300 leading-relaxed mb-10">
          RC Football is a free flag football play designer built specifically for amateur coaches. No
          subscription, no paywall on core features, and no design experience required. If you can drag
          and drop, you can build a play.
        </p>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-2">Try RC Football — It's Free</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Design your first play in under two minutes. No account required to start.
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
