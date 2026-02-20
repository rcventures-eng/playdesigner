import { Helmet } from "react-helmet-async";
import PlayDesigner from "@/components/PlayDesigner";

interface HomeProps {
  isAdmin?: boolean;
  setIsAdmin?: (value: boolean) => void;
  showSignUp?: boolean;
  setShowSignUp?: (value: boolean) => void;
}

export default function Home({ isAdmin, setIsAdmin, showSignUp, setShowSignUp }: HomeProps) {
  return (
    <>
      <Helmet>
        <title>Flag Football Play Designer — Free Playbook Tool for Coaches | RC Football</title>
        <meta name="description" content="Design flag football plays and build your playbook online — free. Drag-and-drop play designer built for flag football coaches at every level." />
        <link rel="canonical" href="https://rc-football.com" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "name": "RC Football",
              "url": "https://rc-football.com",
              "description": "Free football play designer and playbook builder for amateur coaches."
            },
            {
              "@type": "SoftwareApplication",
              "name": "RC Football Play Designer",
              "applicationCategory": "SportsApplication",
              "description": "Free drag-and-drop football play designer and playbook builder for amateur coaches. Supports 5v5, 7v7, and 11v11 football with AI play generation and Google Drive export.",
              "operatingSystem": "Web",
              "url": "https://rc-football.com",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "featureList": "Drag-and-drop play designer, AI play generation, Team management, Google Drive export, Playbook organization, Mobile support"
            },
            {
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is RC Football?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "RC Football is a free web app for amateur football coaches to design plays, manage teams, and build playbooks. You can design plays with a drag-and-drop canvas, generate plays with AI, and export full playbooks to Google Drive."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Is RC Football free to use?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. RC Football is completely free for amateur coaches. There is no subscription, no paywall on core features, and no credit card required to sign up."
                  }
                },
                {
                  "@type": "Question",
                  "name": "What football formats does RC Football support?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "RC Football supports 5v5, 7v7, and 11v11 football formats. You can design plays for flag football, youth leagues, high school, and recreational leagues."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Can I export my playbook to Google Drive?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. RC Football integrates directly with Google Drive. You can export your full playbook as a Google Doc or Slides presentation, choosing how many plays appear per page and using a printer-friendly mode to save ink."
                  }
                },
                {
                  "@type": "Question",
                  "name": "Does RC Football work on mobile?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes. RC Football has a dedicated mobile experience with a touch-optimized canvas for designing plays on phones and tablets."
                  }
                }
              ]
            }
          ]
        })}</script>
      </Helmet>
      <PlayDesigner
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        showSignUp={showSignUp}
        setShowSignUp={setShowSignUp}
      />
    </>
  );
}
