const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    // Fetch complete product details for wishlist items
    const products = await Product.find({
      _id: { $in: user.wishlist }
    }).populate('category');

    res.render("user/wishlist", {
      user,
      products: products || []
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.redirect("/pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;

    // Validate product ID
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    // Find user and check if exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Initialize wishlist array if it doesn't exist
    if (!user.wishlist) {
      user.wishlist = [];
    }

    // Check if product is already in wishlist
    const isProductInWishlist = user.wishlist.some(id => id.toString() === productId);
    if (isProductInWishlist) {
      // If product is in wishlist, remove it (toggle functionality)
      user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
      await user.save();
      return res.status(200).json({
        success: true,
        message: "Product removed from wishlist",
        action: "removed"
      });
    }

    // Add product to wishlist
    user.wishlist.push(productId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      action: "added"
    });
  } catch (error) {
    console.error("Error in wishlist operation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update wishlist"
    });
  }
};

const removeProduct = async (req, res) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.user;

    if (!productId) {
      req.flash('error', 'Product ID is required');
      return res.redirect("/wishlist");
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/login");
    }

    // Remove product from wishlist
    user.wishlist = user.wishlist.filter(id => id.toString() !== productId);
    await user.save();

    res.redirect("/wishlist");
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeProduct
};