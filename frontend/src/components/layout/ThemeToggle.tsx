import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </motion.div>
    </Button>
  );
}
