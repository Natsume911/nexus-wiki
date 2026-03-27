import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  email?: string;
  avatar?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-7 w-7 text-xs',
  lg: 'h-9 w-9 text-sm',
};

export function UserAvatar({ name, email, avatar, size = 'md', className, color }: UserAvatarProps) {
  const initial = (name || email || '?').charAt(0).toUpperCase();
  const sizeClass = sizeClasses[size];

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name || email || ''}
        className={cn('rounded-full object-cover shrink-0', sizeClass, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium shrink-0',
        sizeClass,
        !color && 'bg-accent/10 text-accent',
        className,
      )}
      style={color ? { backgroundColor: color, color: '#fff' } : undefined}
    >
      {initial}
    </div>
  );
}
