import { motion } from "framer-motion";
import { Smartphone } from "lucide-react";

interface OrientationPromptProps {
  isVisible: boolean;
}

export function OrientationPrompt({ isVisible }: OrientationPromptProps) {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8"
      data-testid="orientation-prompt"
    >
      <motion.div
        className="mb-8"
        animate={{ rotate: [0, -90, -90, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 1,
          times: [0, 0.3, 0.7, 1],
        }}
      >
        <Smartphone className="w-24 h-24 text-primary" strokeWidth={1.5} />
      </motion.div>

      <h1 
        className="text-2xl font-bold text-foreground text-center mb-3"
        data-testid="text-rotate-title"
      >
        Rotate for Best Experience
      </h1>
      
      <p 
        className="text-muted-foreground text-center max-w-xs"
        data-testid="text-rotate-description"
      >
        The play designer works best in landscape mode. Please rotate your device to continue.
      </p>
    </div>
  );
}
