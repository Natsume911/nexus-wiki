import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Breadcrumb as BreadcrumbType } from '@/types';

interface BreadcrumbProps {
  spaceSlug: string;
  spaceName: string;
  items: BreadcrumbType[];
}

export function Breadcrumb({ spaceSlug, spaceName, items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-text-muted">
      <Link
        to={`/${spaceSlug}`}
        className="hover:text-text-primary transition-colors truncate max-w-[120px]"
        title={spaceName}
      >
        {spaceName}
      </Link>
      {items.map((item) => (
        <span key={item.id} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link
            to={`/${spaceSlug}/${item.slug}`}
            className="hover:text-text-primary transition-colors truncate max-w-[160px]"
            title={item.title}
          >
            {item.title}
          </Link>
        </span>
      ))}
    </nav>
  );
}
