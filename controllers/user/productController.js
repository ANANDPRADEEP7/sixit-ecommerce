const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const User=require("../../models/userSchema");

const productDetails=async(req,res)=>{
  try {
    const userId=req.session.user;
    const userData=await User.findById(userId);
    const productId=req.query.id;
    const product=await Product.findById(productId).populate('category');
    const findCategory=product.category;

    // Check if product is in user's wishlist
    let productWithWishlist = product.toObject();
    if (userData && userData.wishlist) {
      productWithWishlist.isInWishlist = userData.wishlist.some(id => id.toString() === productId.toString());
    }

    // Add review data
    productWithWishlist.reviews = product.reviews || [];
    productWithWishlist.averageRating = calculateAverageRating(product.reviews);
    productWithWishlist.ratingCounts = calculateRatingCounts(product.reviews);

    // Fetch related products (same category, different product)
    const relatedProducts = await Product.find({
      category: findCategory._id,
      _id: { $ne: productId },
      isBlocked: false,
      quantity: { $gt: 0 }
    })
    .populate('category')
    .limit(4);

    // Calculate effective offers for related products
    const relatedProductsWithOffers = relatedProducts.map(prod => {
      const prodObj = prod.toObject();
      const categoryOffer = prod.category.categoryOffer || 0;
      const productOffer = prod.productOffer || 0;
      prodObj.effectiveOffer = Math.max(categoryOffer, productOffer);
      
      // Calculate discounted price
      if (prodObj.effectiveOffer > 0) {
        const discount = (prodObj.regularPrice * prodObj.effectiveOffer) / 100;
        prodObj.salePrice = Math.floor(prodObj.regularPrice - discount);
      }

      // Calculate average rating for related product
      prodObj.averageRating = calculateAverageRating(prod.reviews);
      
      return prodObj;
    });

    res.render("productDetails",{
      user: userData,
      product: productWithWishlist,
      quantity: product.quantity,
      category: findCategory,
      relatedProducts: relatedProductsWithOffers,
      calculateAverageRating
    });

  } catch (error) {
    console.log("Error for fetching product details",error);
    res.redirect("/pageNotFound");
  }
}

// Helper function to calculate average rating
const calculateAverageRating = (reviews) => {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / reviews.length;
};

// Helper function to calculate rating counts
const calculateRatingCounts = (reviews) => {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!reviews) return counts;
  
  reviews.forEach(review => {
    counts[review.rating] = (counts[review.rating] || 0) + 1;
  });
  return counts;
};

// Handle review submission
const submitReview = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.params;
    const { rating, comment } = req.body;

    // Validate inputs
    if (!rating || !comment) {
      return res.status(400).json({ error: 'Rating and comment are required' });
    }

    const user = await User.findById(userId);
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Create review object
    const review = {
      userId: userId,
      userName: user.name || 'Anonymous',
      rating: parseInt(rating),
      comment: comment,
      createdAt: new Date()
    };

    // Add review to product
    if (!product.reviews) {
      product.reviews = [];
    }

    // Check if user has already reviewed
    const existingReviewIndex = product.reviews.findIndex(
      review => review.userId.toString() === userId.toString()
    );

    if (existingReviewIndex !== -1) {
      // Update existing review
      product.reviews[existingReviewIndex] = review;
    } else {
      // Add new review
      product.reviews.push(review);
    }

    await product.save();

    // Redirect back to product details page
    res.redirect(`/productDetails?id=${productId}`);

  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports={
  productDetails,
  submitReview
};