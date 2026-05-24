import { format, parseISO, formatDistanceToNow } from 'date-fns';

export const formatDate = (date: Date | string, pattern = 'yyyy-MM-dd') => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
};

export const timeAgo = (date: Date | string) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
};
