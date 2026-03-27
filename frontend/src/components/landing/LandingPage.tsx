import { motion } from 'framer-motion';
import { BookOpen, Search, Image, Code, Shield, Zap } from 'lucide-react';
import { useT } from '@/i18n';
import type { TranslationKey } from '@/i18n/types';

const features: { icon: React.ReactNode; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    icon: <BookOpen className="h-6 w-6" />,
    titleKey: 'landing.feature1Title',
    descKey: 'landing.feature1Desc',
  },
  {
    icon: <Image className="h-6 w-6" />,
    titleKey: 'landing.feature2Title',
    descKey: 'landing.feature2Desc',
  },
  {
    icon: <Search className="h-6 w-6" />,
    titleKey: 'landing.feature3Title',
    descKey: 'landing.feature3Desc',
  },
  {
    icon: <Code className="h-6 w-6" />,
    titleKey: 'landing.feature4Title',
    descKey: 'landing.feature4Desc',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    titleKey: 'landing.feature5Title',
    descKey: 'landing.feature5Desc',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    titleKey: 'landing.feature6Title',
    descKey: 'landing.feature6Desc',
  },
];

export function LandingPage() {
  const t = useT();
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent-hover/5" />
        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-6">
              <Zap className="h-3.5 w-3.5" />
              {t('landing.badge')}
            </div>
            <h1 className="text-5xl sm:text-6xl font-display font-bold text-text-primary mb-4 leading-tight">
              {t('landing.heroTitle')}
              <span className="bg-gradient-to-r from-accent to-accent-hover bg-clip-text text-transparent">{t('landing.heroTitleHighlight')}</span>
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
              {t('landing.heroDesc')}
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="/wiki/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors shadow-lg shadow-accent/25"
              >
                <BookOpen className="h-4 w-4" />
                {t('landing.cta')}
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-display font-bold text-text-primary mb-2">
            {t('landing.featuresTitle')}
          </h2>
          <p className="text-text-secondary">
            {t('landing.featuresSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="p-6 rounded-xl border border-border-primary bg-bg-secondary hover:border-accent/30 transition-colors group"
            >
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-accent/10 text-accent mb-4 group-hover:bg-accent/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="font-display font-semibold text-text-primary mb-2">{t(feature.titleKey)}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{t(feature.descKey)}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border-primary">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center text-sm text-text-muted">
          {t('landing.footer')}
        </div>
      </div>
    </div>
  );
}
