import PlayDesigner from "@/components/PlayDesigner";

interface HomeProps {
  isAdmin?: boolean;
  setIsAdmin?: (value: boolean) => void;
  showSignUp?: boolean;
  setShowSignUp?: (value: boolean) => void;
}

export default function Home({ isAdmin, setIsAdmin, showSignUp, setShowSignUp }: HomeProps) {
  return (
    <PlayDesigner 
      isAdmin={isAdmin} 
      setIsAdmin={setIsAdmin}
      showSignUp={showSignUp}
      setShowSignUp={setShowSignUp}
    />
  );
}
