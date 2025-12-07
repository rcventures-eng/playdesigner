import PlayDesigner from "@/components/PlayDesigner";

interface HomeProps {
  isAdmin?: boolean;
  setIsAdmin?: (value: boolean) => void;
}

export default function Home({ isAdmin, setIsAdmin }: HomeProps) {
  return <PlayDesigner isAdmin={isAdmin} setIsAdmin={setIsAdmin} />;
}
