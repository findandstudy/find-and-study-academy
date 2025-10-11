import { Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export const announcementTypeStyles = {
  info: { 
    bg: 'bg-blue-50 dark:bg-blue-950/30', 
    border: 'border-blue-200 dark:border-blue-800', 
    icon: Info, 
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconColorSmall: 'text-blue-500' 
  },
  success: { 
    bg: 'bg-green-50 dark:bg-green-950/30', 
    border: 'border-green-200 dark:border-green-800', 
    icon: CheckCircle, 
    iconColor: 'text-green-600 dark:text-green-400',
    iconColorSmall: 'text-green-500' 
  },
  warning: { 
    bg: 'bg-yellow-50 dark:bg-yellow-950/30', 
    border: 'border-yellow-200 dark:border-yellow-800', 
    icon: AlertTriangle, 
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    iconColorSmall: 'text-yellow-500' 
  },
  error: { 
    bg: 'bg-red-50 dark:bg-red-950/30', 
    border: 'border-red-200 dark:border-red-800', 
    icon: AlertCircle, 
    iconColor: 'text-red-600 dark:text-red-400',
    iconColorSmall: 'text-red-500' 
  }
} as const;

export const announcementPriorityVariants = {
  low: 'secondary',
  medium: 'default',
  high: 'default',
  urgent: 'destructive'
} as const;

export const announcementStatusVariants = {
  draft: 'secondary',
  published: 'default',
  archived: 'outline'
} as const;

export type AnnouncementType = keyof typeof announcementTypeStyles;
export type AnnouncementPriority = keyof typeof announcementPriorityVariants;
export type AnnouncementStatus = keyof typeof announcementStatusVariants;
