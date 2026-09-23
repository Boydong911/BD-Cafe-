export type CustomizationOption = {
  label: string;
  price_delta: number;
};

export type CustomizationGroup = {
  name: string;
  options: CustomizationOption[];
};

export type CategoryRow = {
  id: string;
  name: string;
};

export type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number;
  category_id: string | null;
  is_available: boolean;
  image_url: string | null;
  customization_options: CustomizationGroup[] | null;
  created_at: string;
  updated_at: string;
  categories: { name: string } | null;
};