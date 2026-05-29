import { supabase, Product, Category, ProductImage, Enquiry } from './supabase';

// ============================================================================
// CATEGORIES
// ============================================================================

export const categoryService = {
  async getAll() {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data as Category[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Category;
  },

  async create(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async update(id: string, updates: Partial<Category>) {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// PRODUCTS
// ============================================================================

export const productService = {
  async getAll(filters?: { categoryId?: string; search?: string; featured?: boolean }) {
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }

    if (filters?.featured) {
      query = query.eq('is_featured', true);
    }

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as Product[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Product;
  },

  async getByIdWithImages(id: string) {
    const product = await this.getById(id);
    const images = await productImageService.getByProductId(id);
    return { ...product, images };
  },

  async getFeatured(limit: number = 6) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('display_order', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data as Product[];
  },

  async search(query: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data as Product[];
  },

  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async update(id: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean) {
    return this.update(id, { is_active: isActive });
  },

  async toggleFeatured(id: string, isFeatured: boolean) {
    return this.update(id, { is_featured: isFeatured });
  },
};

// ============================================================================
// PRODUCT IMAGES
// ============================================================================

export const productImageService = {
  async getByProductId(productId: string) {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data as ProductImage[];
  },

  async create(image: Omit<ProductImage, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('product_images')
      .insert(image)
      .select()
      .single();

    if (error) throw error;
    return data as ProductImage;
  },

  async update(id: string, updates: Partial<ProductImage>) {
    const { data, error } = await supabase
      .from('product_images')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ProductImage;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// ENQUIRIES
// ============================================================================

export const enquiryService = {
  async create(enquiry: Omit<Enquiry, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('enquiries')
      .insert(enquiry)
      .select()
      .single();

    if (error) throw error;
    return data as Enquiry;
  },

  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Enquiry[];
  },

  async getAll() {
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Enquiry[];
  },

  async updateStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('enquiries')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Enquiry;
  },
};

// ============================================================================
// STORAGE
// ============================================================================

export const storageService = {
  async uploadProductImage(file: File, productId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${productId}-${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async deleteProductImage(filePath: string) {
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) throw error;
  },

  getPublicUrl(filePath: string) {
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  },
};
