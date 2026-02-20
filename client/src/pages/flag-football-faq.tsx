import { Helmet } from "react-helmet-async";
import { useLocation, Link } from "wouter";
import TopNav from "@/components/TopNav";

const faqs = [
  {
    question: "What is the best free flag football play designer?",
    answer: "RC Football is a free, web-based flag football play designer built specifically for amateur coaches. It includes a drag-and-drop canvas, route drawing tools, team management, playbook organization, and Google Drive export — all at no cost. No subscription required and no paywall on core features."
  },
  {
    question: "How do you draw up flag football plays?",
    answer: "To draw up a flag football play, start by choosing your format (5v5 or 7v7) and selecting a formation. Place your players on the field, then draw routes for each receiver using the route tool. Label the play with a name and any coaching notes, then save it to your playbook. Most plays take 2–5 minutes to diagram once you know the concept."
  },
  {
    question: "What formations work best in 5-on-5 flag football?",
    answer: "The three most effective 5-on-5 flag football formations are Trips (3x1), Bunch, and Stack. Trips creates a numbers advantage against zone coverage. Bunch generates natural picks at the line of scrimmage to beat man coverage. Stack stresses both man and zone by forcing defenders to declare their leverage before the snap. Running all three in combination makes your offense harder to defend."
  },
  {
    question: "How many plays should a flag football playbook have?",
    answer: "Most youth and recreational flag football teams should start with 10–15 plays and master those before adding more. A 50-play playbook your team executes at 50% is worse than a 12-play playbook they execute at 90%. Organize plays by game situation — base offense, red zone, third-and-short, and two-minute drill — rather than numbering them sequentially."
  },
  {
    question: "What is the difference between flag football and tackle football formations?",
    answer: "Flag football formations differ from tackle football in three key ways: no contact blocking removes the offensive line, smaller formats (5v5 and 7v7) mean fewer players and different spacing, and every player is a potential receiver. This shifts formation strategy away from run blocking and line play toward route combinations, motion patterns, and receiver alignment that creates pre-snap advantages."
  },
  {
    question: "How do I export my flag football playbook?",
    answer: "In RC Football, you can export your playbook directly to Google Drive as a Google Doc or Google Slides presentation. Choose handout format (2–4 plays per page) for player reference sheets or presentation format (1 play per slide) for team meetings. A printer-friendly 'Less Color' mode reduces ink usage for physical copies."
  },
  {
    question: "Can I use RC Football on my phone?",
    answer: "Yes. RC Football has a dedicated mobile experience with a touch-optimized canvas. The mobile play designer uses a three-step wizard — choose your field, place your players and draw routes, then save and export. You can design plays from the sideline between drives or build your playbook anywhere."
  },
  {
    question: "What is flag football?",
    answer: "Flag football is a non-contact version of American football where players wear flags attached to their waist. Instead of tackling, defenders remove a ball carrier's flag to stop the play. Common formats include 5-on-5 and 7-on-7. Flag football is played at youth, adult recreational, and competitive tournament levels, and is the fastest-growing football format in the United States."
  },
  {
    question: "How do I teach flag football plays to my team?",
    answer: "Start by walking through each play without a ball so players understand their assignments before adding execution pressure. Teach the quarterback's reads alongside receiver routes — players execute better when they understand the whole play, not just their piece. Provide printed or digital diagrams players can review before practice. Repeat each play until execution is automatic before adding new ones to your playbook."
  },
  {
    question: "What is a flag football playbook?",
    answer: "A flag football playbook is an organized collection of plays a team has prepared for game situations. A good playbook includes a base offense for standard downs, red zone plays for short-field situations, third-down conversion plays, and a two-minute drill for end-of-half scoring drives. Playbooks are usually shared with players as printed sheets or digital files before games."
  }
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      "mainEntity": faqs.map((faq) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rc-football.com" },
        { "@type": "ListItem", "position": 2, "name": "Flag Football FAQ", "item": "https://rc-football.com/flag-football-faq" }
      ]
    }
  ]
};

export default function FlagFootballFaq() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>Flag Football FAQ — Common Questions Answered | RC Football</title>
        <meta name="description" content="Answers to the most common flag football questions — from play design and formations to playbook size, exporting, and how to teach your team." />
        <link rel="canonical" href="https://rc-football.com/flag-football-faq" />
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

        <h1 className="text-3xl font-bold text-white mb-4">Flag Football FAQ</h1>
        <p className="text-slate-300 text-lg leading-relaxed mb-10">
          Answers to the most common questions about flag football play design, formations,
          playbooks, and using RC Football.
        </p>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h2 className="text-white font-semibold mb-3">{faq.question}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-4">Related guides</h2>
          <ul className="space-y-2">
            <li><Link href="/how-to-design-flag-football-plays" className="text-orange-400 hover:text-orange-300 text-sm transition-colors">How to Design Flag Football Plays — Step-by-Step</Link></li>
            <li><Link href="/flag-football-formations" className="text-orange-400 hover:text-orange-300 text-sm transition-colors">Flag Football Formations: Complete 5v5 and 7v7 Guide</Link></li>
            <li><Link href="/flag-football-playbook-guide" className="text-orange-400 hover:text-orange-300 text-sm transition-colors">Beginner's Guide to Flag Football Playbooks</Link></li>
            <li><Link href="/what-is-a-flag-football-play-designer" className="text-orange-400 hover:text-orange-300 text-sm transition-colors">What Is a Flag Football Play Designer?</Link></li>
          </ul>
        </div>

        <div className="mt-12 bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-2">Still have questions?</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            Try RC Football for free — or get in touch if you have a question we haven't answered.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setLocation("/")}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              Open the Play Designer
            </button>
            <button
              onClick={() => setLocation("/contact")}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              Contact Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
