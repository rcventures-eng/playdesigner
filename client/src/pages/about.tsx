import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import TopNav from "@/components/TopNav";

const features = [
  {
    title: "Play Designer Canvas",
    description:
      "Drag-and-drop players onto a football field, draw routes, add assignments, and build any formation you need. Supports offensive, defensive, and special teams layouts.",
  },
  {
    title: "AI Play Generation",
    description:
      "Describe a concept in plain language and let the AI generate a play for you. You can also sketch a diagram and have it interpreted automatically.",
  },
  {
    title: "Team Management",
    description:
      "Create multiple teams, manage rosters, organize coaching staff, and build squad splits for practice groups — all in one place.",
  },
  {
    title: "Playbook Organization",
    description:
      "Group plays into playbooks, add section dividers, and keep your game plan structured and easy to share with your coaching staff.",
  },
  {
    title: "Google Drive Export",
    description:
      "Export your playbook as a Google Doc or Slides presentation. Choose handout or presentation format, control how many plays appear per page, and use printer-friendly mode to save ink.",
  },
  {
    title: "Free, Always",
    description:
      "RC Football is and will remain free for amateur coaches. No subscription, no paywall on core features.",
  },
];

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Helmet>
        <title>About RC Football — Free Football Play Designer for Coaches</title>
        <meta name="description" content="Learn about RC Football, the free web app built for amateur flag football coaches to design plays, manage teams, and export playbooks." />
      </Helmet>
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <button
          onClick={() => setLocation("/")}
          className="text-sm text-orange-400 hover:text-orange-300 transition-colors mb-8 inline-block"
        >
          &larr; Back to RC Football
        </button>

        <h1 className="text-3xl font-bold text-white mb-4">About RC Football</h1>
        <p className="text-slate-300 text-lg leading-relaxed mb-10">
          RC Football is a free web app built for amateur flag football coaches who want
          professional-grade tools without the pro-grade price tag. Design plays, manage
          your roster, build full playbooks, and export everything to Google Drive — all
          from your browser.
        </p>

        <h2 className="text-xl font-semibold text-white mb-6">What You Can Do</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-800 border border-slate-700 rounded-lg p-5"
            >
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-2">Built by a Coach, for Coaches</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            RC Football was created by RC Ventures to give amateur flag football coaches the
            same kind of tools that pro coaching staffs take for granted. If you have
            feedback, a feature request, or just want to say hi, we'd love to hear from you.
          </p>
          <button
            onClick={() => setLocation("/contact")}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
          >
            Get in Touch
          </button>
        </div>
      </div>
    </div>
  );
}
