export type ResourceCategory = 
  | 'All' 
  | 'TOEFL Prep' 
  | 'Grammar & Vocab' 
  | 'Reading & Phonics' 
  | 'Auto-Grade Quizzes' 
  | 'Academic Writing'
  | 'Classroom Games';

export interface QuickLinkItem {
  id: string;
  title: string;
  category: string;
  badge?: string;
  description: string;
  iconName: string;
  path: string;
}

export interface ResourceItem {
  id: string;
  title: string;
  category: ResourceCategory;
  description: string;
  tag: string;
  tags: string[];
}

export interface TestimonialItem {
  id: string;
  author: string;
  role: string;
  school: string;
  location: string;
  avatarUrl: string;
  metric: string;
  quote: string;
  rating: number;
  badge: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
  ctaText: string;
  targetUser: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'Platform' | 'Grading & AI' | 'Curriculum' | 'Pricing & Schools';
}
