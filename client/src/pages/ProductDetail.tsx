import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, MessageCircle, Share2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { productService, productImageService } from '@/lib/productService';
import { Product, ProductImage } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const { isAuthenticated } = useAuthStore();

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '919773239442';
  const phone1 = import.meta.env.VITE_PHONE_1 || '9773239442';

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;

      try {
        const prod = await productService.getById(id);
        setProduct(prod);

        const imgs = await productImageService.getByProductId(id);
        setImages(imgs);
      } catch (error) {
        console.error('Error loading product:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleEnquire = () => {
    const message = `Hi, I'm interested in: ${product?.name}\n\nPrice: ₹${product?.price}\nQuantity: ${product?.quantity_in_unit} ${product?.unit_of_measure}\n\nPlease provide more details and availability.`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: `Check out this product: ${product?.name}`,
        url: window.location.href,
      });
    }
  };

  const handleImageError = (imageId: string) => {
    setImageErrors((prev) => {
      const newSet = new Set(prev);
      newSet.add(imageId);
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Loading product...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-500 text-lg mb-4">Product not found</p>
            <button
              onClick={() => setLocation('/catalog')}
              className="text-red-600 font-semibold hover:text-red-700"
            >
              Back to Catalog
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const displayImages = images.length > 0 ? images : [];
  const mainImage =
    displayImages.length > 0
      ? displayImages[selectedImageIndex]?.image_url
      : product.image_url;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <button
            onClick={() => setLocation('/catalog')}
            className="flex items-center gap-2 text-red-600 font-semibold hover:text-red-700 mb-8 transition"
          >
            <ArrowLeft size={18} />
            Back to Catalog
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Images Section */}
            <div>
              {/* Main Image */}
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-4 aspect-square flex items-center justify-center">
                {mainImage && !imageErrors.has(`main-${selectedImageIndex}`) ? (
                  <img
                    src={mainImage}
                    alt={product.image_alt_text || product.name}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(`main-${selectedImageIndex}`)}
                  />
                ) : (
                  <ImagePlaceholder className="w-full h-full" showText={true} />
                )}
              </div>

              {/* Thumbnail Gallery */}
              {displayImages.length > 1 && (
                <div className="flex gap-3 overflow-x-auto">
                  {displayImages.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition ${
                        selectedImageIndex === idx
                          ? 'border-red-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {!imageErrors.has(img.id) ? (
                        <img
                          src={img.image_url}
                          alt={img.alt_text || `Product image ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(img.id)}
                        />
                      ) : (
                        <ImagePlaceholder className="w-20 h-20" showText={false} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div>
              <div className="bg-white border border-slate-200 rounded-lg p-8">
                {/* Header */}
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  {product.name}
                </h1>
                <p className="text-slate-500 text-sm mb-6">
                  SKU: {product.sku || 'N/A'}
                </p>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-slate-200">
                  {isAuthenticated ? (
                    <div>
                      <p className="text-slate-600 text-sm font-semibold mb-2">Price</p>
                      <p className="text-4xl font-bold text-red-600">
                        ₹{product.price.toLocaleString()}
                      </p>
                      <p className="text-slate-500 text-sm mt-2">
                        Per {product.quantity_in_unit} {product.unit_of_measure}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-center">
                      <p className="text-slate-600 font-semibold mb-2">
                        Sign in to view pricing
                      </p>
                      <button
                        onClick={() => setLocation('/auth')}
                        className="text-red-600 font-semibold hover:text-red-700"
                      >
                        Sign In Now
                      </button>
                    </div>
                  )}
                </div>

                {/* Specifications */}
                {product.specifications && Object.keys(product.specifications).length > 0 && (
                  <div className="mb-8 pb-8 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-4">Specifications</h3>
                    <div className="space-y-3">
                      {Object.entries(product.specifications).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-slate-600 capitalize">{key}:</span>
                          <span className="font-semibold text-slate-900">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {product.description && (
                  <div className="mb-8 pb-8 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-3">Description</h3>
                    <p className="text-slate-600 leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Features */}
                <div className="mb-8 pb-8 border-b border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Key Features</h3>
                  <ul className="space-y-2">
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>
                      Premium quality materials
                    </li>
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>
                      Bulk order discounts available
                    </li>
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>
                      Fast delivery in Surat
                    </li>
                    <li className="flex gap-2 text-slate-600">
                      <span className="text-red-600 font-bold">✓</span>
                      GST invoice provided
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleEnquire}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={20} />
                    Enquire on WhatsApp
                  </button>

                  <div className="flex gap-3">
                    <a
                      href={`tel:${phone1}`}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition text-center"
                    >
                      📞 Call
                    </a>
                    <button
                      onClick={handleShare}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Share2 size={18} />
                      Share
                    </button>
                  </div>
                </div>

                {/* Info Box */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                  <p className="font-semibold mb-1">💡 Need bulk quantities?</p>
                  <p>
                    Contact us for special pricing on bulk orders and customization options.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
