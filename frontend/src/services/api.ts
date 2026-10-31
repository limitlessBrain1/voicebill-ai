import axios, { AxiosError } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Automatically inject JWT Bearer token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle unauthorized errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token on 401 Unauthorized
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
    }
    return Promise.reject(error);
  }
);

export interface HealthCheckResponse {
  status: string;
  message: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  shop_id: number;
  shop_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface CategoryResponse {
  id: number;
  name: string;
  shop_id: number;
  created_at: string;
  updated_at: string;
}

export interface ProductResponse {
  id: number;
  name: string;
  shop_id: number;
  category_id: number | null;
  purchase_price: string;
  selling_price: string;
  pack_size: string;
  unit: string;
  stock_quantity: string;
  low_stock_threshold: string;
  barcode: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Extract human-readable error message from backend Axios error
 */
export const extractErrorMessage = (error: unknown, fallback = 'An unexpected error occurred'): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      // Pydantic validation error array
      const messages = detail.map((d: { msg?: string; loc?: string[] }) => {
        const field = d.loc ? d.loc.filter(l => l !== 'body').join('.') : '';
        return field ? `${field}: ${d.msg || 'Invalid value'}` : (d.msg || 'Invalid value');
      });
      return messages.join(', ');
    }
    if (error.response?.data?.message) {
      return String(error.response.data.message);
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
};

/**
 * Pings backend health endpoint GET /api/health
 */
export const getBackendHealth = async (): Promise<HealthCheckResponse> => {
  const response = await apiClient.get<HealthCheckResponse>('/api/health');
  return response.data;
};

/**
 * Authenticates user via POST /api/auth/login
 */
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/api/auth/login', {
    email,
    password,
  });
  if (response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
    localStorage.setItem('access_token', response.data.access_token);
  }
  return response.data;
};

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  shop_name: string;  // Store name — backend creates the shop automatically
}

/**
 * Registers a new user + store via POST /api/auth/register
 */
export const registerUser = async (data: RegisterData): Promise<UserResponse> => {
  const response = await apiClient.post<UserResponse>('/api/auth/register', {
    name: data.name,
    email: data.email,
    phone: data.phone,
    password: data.password,
    shop_name: data.shop_name,
  });
  return response.data;
};

/**
 * Fetches current user profile via GET /api/auth/me
 */
export const getCurrentUser = async (): Promise<UserResponse> => {
  const response = await apiClient.get<UserResponse>('/api/auth/me');
  return response.data;
};

/**
 * Fetches categories scoped to authenticated user's shop via GET /api/categories
 */
export const getCategories = async (): Promise<CategoryResponse[]> => {
  const response = await apiClient.get<CategoryResponse[]>('/api/categories');
  return response.data;
};

/**
 * Creates a new category scoped to authenticated user's shop via POST /api/categories
 */
export const createCategory = async (name: string): Promise<CategoryResponse> => {
  const response = await apiClient.post<CategoryResponse>('/api/categories', { name });
  return response.data;
};

export interface ProductCreateData {
  name: string;
  category_id?: number | null;
  purchase_price: string | number;
  selling_price: string | number;
  pack_size?: string | number;
  unit: string;
  stock_quantity?: string | number;
  low_stock_threshold?: string | number;
  barcode?: string | null;
}

/**
 * Creates a new product scoped to authenticated user's shop via POST /api/products
 */
export const createProduct = async (data: ProductCreateData): Promise<ProductResponse> => {
  const response = await apiClient.post<ProductResponse>('/api/products', data);
  return response.data;
};

export interface ProductUpdateData {
  name?: string;
  category_id?: number | null;
  purchase_price?: string | number;
  selling_price?: string | number;
  pack_size?: string | number;
  unit?: string;
  stock_quantity?: string | number;
  low_stock_threshold?: string | number | null;
  barcode?: string | null;
  is_active?: boolean;
}

/**
 * Fetches products scoped to authenticated user's shop via GET /api/products
 */
export const getProducts = async (params?: {
  search?: string;
  is_active?: boolean;
  category_id?: number;
}): Promise<ProductResponse[]> => {
  const response = await apiClient.get<ProductResponse[]>('/api/products', {
    params,
  });
  return response.data;
};

/**
 * Fetches single product by ID via GET /api/products/:id
 */
export const getProduct = async (productId: number): Promise<ProductResponse> => {
  const response = await apiClient.get<ProductResponse>(`/api/products/${productId}`);
  return response.data;
};

/**
 * Updates product attributes via PUT /api/products/:id
 */
export const updateProduct = async (
  productId: number,
  data: ProductUpdateData
): Promise<ProductResponse> => {
  const response = await apiClient.put<ProductResponse>(`/api/products/${productId}`, data);
  return response.data;
};

/**
 * Updates stock quantity via PATCH /api/products/:id/stock
 */
export const updateProductStock = async (
  productId: number,
  stockQuantity: string | number
): Promise<ProductResponse> => {
  const response = await apiClient.patch<ProductResponse>(`/api/products/${productId}/stock`, {
    stock_quantity: stockQuantity,
  });
  return response.data;
};

/**
 * Updates active status via PATCH /api/products/:id/status
 */
export const updateProductStatus = async (
  productId: number,
  isActive: boolean
): Promise<ProductResponse> => {
  const response = await apiClient.patch<ProductResponse>(`/api/products/${productId}/status`, {
    is_active: isActive,
  });
  return response.data;
};

/**
 * Soft deletes product via DELETE /api/products/:id
 */
export const deleteProduct = async (productId: number): Promise<void> => {
  await apiClient.delete(`/api/products/${productId}`);
};

// -----------------------------------------------------------------------------
// Billing Cart Types & API Functions
// -----------------------------------------------------------------------------

export interface CartItemResponse {
  id: number;
  product_id: number;
  product_name: string;
  quantity: string | number;
  unit: string;
  unit_price: string | number;
  line_total: string | number;
  pack_size?: string | number | null;
  stock_quantity?: string | number | null;
}

export interface CartResponse {
  id: number;
  shop_id: number;
  user_id: number;
  status: string;
  items: CartItemResponse[];
  subtotal: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  total: string | number;
  created_at: string;
  updated_at: string;
}

/**
 * Creates a new draft billing cart via POST /api/billing/cart
 */
export const createCart = async (): Promise<CartResponse> => {
  const response = await apiClient.post<CartResponse>('/api/billing/cart');
  return response.data;
};

/**
 * Retrieves or creates the current active draft cart via GET /api/billing/cart/active/current
 */
export const getActiveCart = async (): Promise<CartResponse> => {
  const response = await apiClient.get<CartResponse>('/api/billing/cart/active/current');
  return response.data;
};

/**
 * Retrieves a specific cart by ID via GET /api/billing/cart/:id
 */
export const getCart = async (cartId: number): Promise<CartResponse> => {
  const response = await apiClient.get<CartResponse>(`/api/billing/cart/${cartId}`);
  return response.data;
};

/**
 * Adds an item to a billing cart via POST /api/billing/cart/:id/items
 */
export const addCartItem = async (
  cartId: number,
  productId: number,
  quantity: string | number
): Promise<CartResponse> => {
  const response = await apiClient.post<CartResponse>(`/api/billing/cart/${cartId}/items`, {
    product_id: productId,
    quantity,
  });
  return response.data;
};

/**
 * Updates an item's quantity in the billing cart via PUT /api/billing/cart/:id/items/:itemId
 */
export const updateCartItemQuantity = async (
  cartId: number,
  itemId: number,
  quantity: string | number
): Promise<CartResponse> => {
  const response = await apiClient.put<CartResponse>(
    `/api/billing/cart/${cartId}/items/${itemId}`,
    {
      quantity,
    }
  );
  return response.data;
};

/**
 * Removes an item from the billing cart via DELETE /api/billing/cart/:id/items/:itemId
 */
export const removeCartItem = async (
  cartId: number,
  itemId: number
): Promise<CartResponse> => {
  const response = await apiClient.delete<CartResponse>(
    `/api/billing/cart/${cartId}/items/${itemId}`
  );
  return response.data;
};

/**
 * Clears all items from the billing cart via DELETE /api/billing/cart/:id/clear
 */
export const clearCart = async (cartId: number): Promise<CartResponse> => {
  const response = await apiClient.delete<CartResponse>(`/api/billing/cart/${cartId}/clear`);
  return response.data;
};

export interface VoiceBillingMatchedProduct {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
  selling_price: string;
  pack_size: string;
  unit: string;
  stock_quantity: string;
  low_stock_threshold: string;
  barcode: string | null;
  is_active: boolean;
}

export interface VoiceBillingParseResponse {
  command: string;
  parsed_product_name: string;
  parsed_quantity: string;
  parsed_unit: string | null;
  resolved_quantity: string;
  match_type: 'exact' | 'multiple' | 'none';
  matches: VoiceBillingMatchedProduct[];
  message: string;
}

/**
 * Parses a voice or text billing command (e.g. 'Add sugar 2 kg')
 * Matches against shop catalog and returns parsed quantity and product matches
 */
export const parseVoiceBillingCommand = async (command: string): Promise<VoiceBillingParseResponse> => {
  const response = await apiClient.post<VoiceBillingParseResponse>('/api/billing/voice/parse', {
    command,
  });
  return response.data;
};

export interface CheckoutRequest {
  payment_method: 'cash' | 'upi';
  amount_received?: number | string;
  payment_reference?: string;
  notes?: string;
}

export interface SaleItemResponse {
  id: number;
  product_id: number | null;
  product_name: string;
  unit: string;
  unit_price: string;
  quantity: string;
  line_total: string;
  created_at: string;
}

export interface PaymentResponse {
  id: number;
  sale_id: number;
  shop_id: number;
  payment_method: string;
  amount: string;
  status: string;
  reference: string | null;
  created_at: string;
}

export interface SaleShopResponse {
  id: number;
  name: string;
  owner_name: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
}

export interface SaleResponse {
  id: number;
  receipt_number: string;
  shop_id: number;
  user_id: number;
  cart_id: number | null;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total_amount: string;
  payment_method: string;
  payment_status: string;
  amount_received: string | null;
  change_due: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: SaleItemResponse[];
  payments: PaymentResponse[];
  shop?: SaleShopResponse | null;
}

export interface SalesListFilterParams {
  receipt_number?: string;
  payment_method?: string;
  payment_status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface SalesListResponse {
  sales: SaleResponse[];
  total_count: number;
  limit: number;
  offset: number;
}

/**
 * Executes atomic checkout of a draft billing cart via POST /api/billing/cart/:id/checkout
 */
export const checkoutCart = async (
  cartId: number,
  data: CheckoutRequest
): Promise<SaleResponse> => {
  const response = await apiClient.post<SaleResponse>(
    `/api/billing/cart/${cartId}/checkout`,
    data
  );
  return response.data;
};

/**
 * Retrieves a sale receipt by sale ID via GET /api/sales/:id
 */
export const getSale = async (saleId: number): Promise<SaleResponse> => {
  const response = await apiClient.get<SaleResponse>(`/api/sales/${saleId}`);
  return response.data;
};

/**
 * Retrieves a sale receipt by receipt number via GET /api/sales/receipt/:receiptNumber
 */
export const getSaleByReceipt = async (receiptNumber: string): Promise<SaleResponse> => {
  const response = await apiClient.get<SaleResponse>(`/api/sales/receipt/${receiptNumber}`);
  return response.data;
};

/**
 * Lists historical sales for current shop via GET /api/sales with search and filters
 */
export const listSales = async (params: SalesListFilterParams = {}): Promise<SalesListResponse> => {
  const response = await apiClient.get<SalesListResponse>('/api/sales', {
    params,
  });
  return response.data;
};

export default apiClient;


