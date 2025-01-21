const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category');
    res.render("user/wishlist", {
      user,
      products
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.redirect("/pageerror");
  }
};

const addToWishlist = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;
    const user = await User.findById(userId);

    if (user.wishlist.includes(productId)) {
      return res.status(200).json({
        success: false,
        message: "Product already in wishlist"
      });
    }

    user.wishlist.push(productId);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist"
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

const removeProduct = async (req, res) => {
  try {
    const productId = req.query.productId;
    const userId = req.session.user;
    const user = await User.findById(userId);

    const index = user.wishlist.indexOf(productId);
    if (index > -1) {
      user.wishlist.splice(index, 1);
      await user.save();
    }

    res.redirect("/wishlist");
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.redirect("/pageerror");
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeProduct
};