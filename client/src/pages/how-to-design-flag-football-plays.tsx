import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

const steps = [
  {
    name: "Choose your format",
    text: "Start by selecting 5-on-5 or 7-on-7. These formats use different field sizes and have different numbers of eligible receivers, which affects every formation you'll diagram. Getting this right first prevents you from redesigning plays later."
  },
  {
    name: "Pick a formation",
    text: "Choose a starting alignment for your offense. For 5-on-5, Trips (3x1), Bunch, and Stack are the most versatile. For 7-on-7, Spread (2x2) and Singleback give you more route combinations. Your formation creates the pre-snap picture — pick one that stresses the defense before the ball is snapped."
  },
  {
    name: "Position your players",
    text: "Drag each player to their spot on the field. In RC Football, player icons are labeled by role — QB, receivers, and center. Place them where you want them at the snap, not where they motion to. Spacing matters: leave enough room between receivers so routes don't immediately collide."
  },
  {
    name: "Draw the routes",
    text: "Click each receiver and draw their route path. Use curved lines for rounded breaks and straight lines for cuts. Every receiver should have a route — even a receiver running a short flat route matters for the quarterback's read progression. Draw the QB's drop and any motion assignments too."
  },
  {
    name: "Label the play",
    text: "Give your play a name that coaches and players will remember under pressure. Short, descriptive names work best: 'Mesh Left,' 'Corner Flag,' 'Trips Right — Wheel.' Add a description noting the coverage it attacks and when to call it."
  },
  {
    name: "Add coaching notes",
    text: "Use the notes tool to add text directly on the diagram — coverage keys, QB reads, route depths, or timing cues. A play your players can read without explanation is more valuable than a complex diagram that requires a meeting to decode."
  },
  {
    name: "Tag and save",
    text: "Assign the play to a team and tag it by situation: base offense, red zone, third-and-short, or two-minute drill. Tagging makes it easy to pull the right plays on game day without scrolling through everything in your playbook."
  }
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "HowTo",
      "name": "How to Design Flag Football Plays",
      "description": "A step-by-step guide to diagramming flag football plays using a digital play designer, from choosing your format to saving your playbook.",
      "totalTime": "PT5M",
      "estimatedCost": { "@type": "MonetaryAmount", "currency": "USD", "value": "0" },
      "tool": [{ "@type": "HowToTool", "name": "RC Football Play Designer" }],
      "step": steps.map((s, i) => ({
        "@type": "HowToStep",
        "position": i + 1,
        "name": s.name,
        "text": s.text
      }))
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rc-football.com" },
        { "@type": "ListItem", "position": 2, "name": "How to Design Flag Football Plays", "item": "https://rc-football.com/how-to-design-flag-football-plays" }
      ]
    }
  ]
};

export default function HowToDesignFlagFootballPlays() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>How to Design Flag Football Plays — Step-by-Step Guide | RC Football</title>
        <meta name="description" content="Learn how to design flag football plays step by step — from choosing your format and formation to drawing routes, labeling plays, and building your playbook." />
        <link rel="canonical" href="https://rc-football.com/how-to-design-flag-football-plays" />
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

        <h1 className="text-3xl font-bold text-white mb-4">How to Design Flag Football Plays</h1>
        <p className="text-slate-300 text-lg leading-relaxed mb-4">
          Designing a flag football play takes 2–5 minutes once you know what you want to run. The
          process is the same whether you're drawing up a simple crossing route or a multi-receiver
          concept with motion: start with format, build your formation, draw routes, and document
          what makes the play work.
        </p>
        <p className="text-slate-400 mb-10">
          A 50-play playbook your team executes at 50% is worse than a 12-play playbook they execute
          at 90%. Design with intention, not volume.
        </p>

        <h2 className="text-xl font-semibold text-white mb-6">The 7 Steps</h2>
        <div className="space-y-6 mb-12">
          {steps.map((step, i) => (
            <div key={step.name} className="flex gap-5">
              <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{step.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.text}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-white mb-4">Tips for Designing Better Plays</h2>
        <ul className="space-y-3 mb-10">
          {[
            "Design every play to attack a specific coverage — zone, man, or blitz. Know what it beats before you teach it.",
            "Build plays in series. If three different plays look the same at the snap, the defense can't adjust fast enough.",
            "Draw the quarterback's eyes, not just the receivers' feet. Where the QB looks shapes how the defense reacts.",
            "Start with 10–15 plays your team can execute confidently, then expand as the season progresses.",
            "Name plays in a system your team understands — numbers, colors, or concepts — so calls are fast under pressure.",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-3 text-slate-300 text-sm">
              <span className="text-orange-400 mt-0.5 shrink-0">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>

        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-2">Design Your First Play Now</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            RC Football's free play designer has everything you need — drag-and-drop players,
            route drawing tools, play notes, and Google Drive export. No account required to start.
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
