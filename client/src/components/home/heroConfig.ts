export type StockBadge = 'In Stock' | 'Ready To Dispatch' | 'Bulk Available';

export interface HeroFloatingProduct {
  title: string;
  slug: string;
  image: string;
  stock: StockBadge;
  position: { top?: string; left?: string; right?: string; bottom?: string };
  delay: number;
}

export const HERO_FLOATING_PRODUCTS: HeroFloatingProduct[] = [
  {
    title: 'Food Containers',
    slug: 'round-container',
    image: '/images/hero/food-containers.png',
    stock: 'In Stock',
    position: { top: '4%', left: '2%' },
    delay: 0,
  },
  {
    title: 'Paper Cups',
    slug: 'paper-cup',
    image: '/images/hero/paper-cups.png',
    stock: 'Bulk Available',
    position: { top: '8%', right: '0%' },
    delay: 0.15,
  },
  {
    title: 'Carry Bags',
    slug: 'paper-box',
    image: '/images/hero/carry-bags.png',
    stock: 'Ready To Dispatch',
    position: { top: '42%', left: '-2%' },
    delay: 0.3,
  },
  {
    title: 'Corrugated Boxes',
    slug: 'paper-box',
    image: '/images/hero/corrugated-boxes.png',
    stock: 'In Stock',
    position: { bottom: '18%', right: '2%' },
    delay: 0.45,
  },
  {
    title: 'Meal Trays',
    slug: 'meal-tray',
    image: '/images/hero/meal-trays.png',
    stock: 'Bulk Available',
    position: { bottom: '6%', left: '18%' },
    delay: 0.6,
  },
  {
    title: 'Packaging Films',
    slug: 'cling-wrap',
    image: '/images/hero/packaging-films.png',
    stock: 'Ready To Dispatch',
    position: { top: '38%', right: '12%' },
    delay: 0.75,
  },
];

export interface PopularCategory {
  name: string;
  slug: string;
  image: string;
  fallbackCount?: number;
}

export const POPULAR_CATEGORIES: PopularCategory[] = [
  { name: 'Food Containers', slug: 'round-container', image: '/images/hero/food-containers.png', fallbackCount: 48 },
  { name: 'Paper Cups', slug: 'paper-cup', image: '/images/hero/paper-cups.png', fallbackCount: 24 },
  { name: 'Carry Bags', slug: 'paper-box', image: '/images/hero/carry-bags.png', fallbackCount: 18 },
  { name: 'Corrugated Boxes', slug: 'paper-box', image: '/images/hero/corrugated-boxes.png', fallbackCount: 22 },
  { name: 'Meal Trays', slug: 'meal-tray', image: '/images/hero/meal-trays.png', fallbackCount: 16 },
  { name: 'Aluminium Containers', slug: 'aluminum-containers', image: '/images/hero/meal-trays.png', fallbackCount: 14 },
  { name: 'Wrapping Films', slug: 'cling-wrap', image: '/images/hero/packaging-films.png', fallbackCount: 12 },
  { name: 'Custom Printed Packaging', slug: 'paper-box', image: '/images/hero/corrugated-boxes.png', fallbackCount: 30 },
];

export type TrustStat =
  | { label: string; value: number; suffix: string }
  | { label: string; text: string };

export const TRUST_STATS: TrustStat[] = [
  { label: 'Businesses Served', value: 500, suffix: '+' },
  { label: 'Products', value: 1000, suffix: '+' },
  { label: 'Hour Dispatch', value: 24, suffix: '' },
  { label: 'India Supply', text: 'Pan India' },
];

export const TRUST_POINTS = [
  'Bulk Wholesale Pricing',
  'Fast Dispatch',
  'Custom Branding Available',
  'Quality Assured Supply',
] as const;

export const BRAND_NAMES = [
  'FreshServe',
  'CloudKitchen Co',
  'BakeHouse',
  'CaterPro',
  'SnackBox',
  'MealRoute',
  'SweetLine',
  'PackRight',
] as const;
