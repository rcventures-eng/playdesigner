import PlayDesigner from "@/components/PlayDesigner";

interface HomeProps {
  isAdmin?: boolean;
  setIsAdmin?: (value: boolean) => void;
  showSignUp?: boolean;
  setShowSignUp?: (value: boolean) => void;
}

export default function Home({ isAdmin, setIsAdmin, showSignUp, setShowSignUp }: HomeProps) {
  return (
    <div className="flex flex-col">
      <section className="w-full py-10 px-4" data-testid="hero-section">
        <div className="max-w-3xl mx-auto text-center">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight"
            data-testid="hero-title"
          >
            Free Football Playbook Maker & Diagram Designer
          </h1>
          <p
            className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto"
            data-testid="hero-description"
          >
            RC Football is a free football playbook maker that helps youth and 11v11 coaches design
            printable football plays in seconds. Use our drag and drop football diagram designer to
            create offensive, defensive, and special teams plays, then download them for your playbook
            or practice plan. Built for youth flag football and full 11v11 tackle coaches.
          </p>
        </div>
      </section>
      <PlayDesigner
        isAdmin={isAdmin}
        setIsAdmin={setIsAdmin}
        showSignUp={showSignUp}
        setShowSignUp={setShowSignUp}
      />
    </div>
  );
}
