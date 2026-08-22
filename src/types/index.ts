export interface ProductVariant {
  id: number;
  variant_name?: string;
  price: number;
  size?: string;
  color?: string;
  imageUrl?: string;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
}

export interface APIProduct {
  id: number;
  productName: string;
  description: string;
  composition?: string;
  discountPercentage?: number;
  active?: boolean;
  renderActive?: boolean;
  birToyActive?: boolean;
  rating: number | null;
  reviewCount?: number;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
  sku?: string;
  productCategory?: Category;
  images: ProductImage[];
  price: number;
  size?: string;
  color?: string;
  single?: boolean;
}

export interface Product {
  id: number;
  title: string;
  price: string;
  desc: string;
  img?: string;
  hoverImg?: string;
  rating: number;
  badge?: string;
  slug: string;
  categoryId: number;
  /** Backend is_single — false olanda studiyada göstərilmir */
  single?: boolean;
  active?: boolean;
  renderActive?: boolean;
  birToyActive?: boolean;
  size?: string;
  color?: string;
}

export interface Category {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  surname?: string;
  phoneNumber?: string;
  gender?: string;
  birthDate?: string;
  role?: string;
  status?: string;
}

export interface PageInfo {
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface PageableResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface FlowerType {
  id: number;
  name: string;
  price: number;
  img: string;
  color: 'RED' | 'WHITE' | 'PINK' | 'YELLOW' | 'BLUE';
}

export interface SelectedFlower extends FlowerType {
  count: number;
}

export interface BouquetConfiguration {
  flowers: { flower: FlowerType; quantity: number }[];
  shape: { name: string };
  material: { type: string; colorName: string };
  ribbonColor: { name: string };
}

export interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  image?: string;
  productImageUrl?: string;
  imageUrl?: string;
  productVariantId?: number;
  variantId?: number;
  color?: string;
  size?: string;
  variantName?: string;
  product?: {
    image?: string;
    productImageUrl?: string;
    imageUrl?: string;
    productName?: string;
  };
}

export interface Cart {
  userId: number;
  items: CartItem[];
  totalAmount: number;
}
