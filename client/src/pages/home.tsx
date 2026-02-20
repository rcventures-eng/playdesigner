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
        <title>Football Play Designer — Free Playbook Tool for Coaches | RC Football</title>
        <meta name="description" content="Free drag-and-drop football play designer for amateur coaches. Design offensive and defensive plays for 5v5, 7v7, and 11v11 football with easy export options." />
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
