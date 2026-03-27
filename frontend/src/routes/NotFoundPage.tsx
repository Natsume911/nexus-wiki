import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';

export function NotFoundPage() {
  const t = useT();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center justify-center h-20 w-20 rounded-2xl bg-accent/10 mb-6"
        >
          <FileQuestion className="h-10 w-10 text-accent" />
        </motion.div>
        <h1 className="text-6xl font-display font-bold text-text-muted mb-2">404</h1>
        <p className="text-lg text-text-secondary mb-2">{t('notFound.title')}</p>
        <p className="text-sm text-text-muted max-w-sm mb-8">
          {t('notFound.description')}
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={() => window.history.back()} variant="secondary" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('notFound.goBack')}
          </Button>
          <Link to="/">
            <Button className="gap-2">
              <Home className="h-4 w-4" />
              {t('notFound.goHome')}
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
